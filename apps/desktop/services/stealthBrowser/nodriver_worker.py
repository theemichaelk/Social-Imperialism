#!/usr/bin/env python3
"""Async nodriver worker — JSON-RPC over stdin/stdout for Node.js bridge."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import traceback
from typing import Any, Dict, Optional

try:
    import nodriver as uc
    from nodriver import Browser, Tab
except ImportError:
    uc = None
    Browser = None
    Tab = None


def _find_browser_executable(explicit: Optional[str] = None) -> Optional[str]:
    if explicit and os.path.isfile(explicit):
        return explicit
    candidates = []
    localappdata = os.environ.get("LOCALAPPDATA", "")
    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
    program_files_x86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    candidates.extend([
        os.path.join(localappdata, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(program_files, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(program_files_x86, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(program_files_x86, "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(program_files, "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(localappdata, "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(localappdata, "Programs", "Opera", "opera.exe"),
        os.path.join(localappdata, "Programs", "Opera GX", "opera.exe"),
    ])
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


class BrowserSession:
    def __init__(self, session_id: str, browser: Browser, tab: Tab):
        self.session_id = session_id
        self.browser = browser
        self.tab = tab

    async def close(self) -> None:
        try:
            stop_result = self.browser.stop()
            if asyncio.iscoroutine(stop_result):
                await stop_result
        except Exception:
            pass


class Worker:
    def __init__(self):
        self.sessions: Dict[str, BrowserSession] = {}

    async def handle(self, req: Dict[str, Any]) -> Dict[str, Any]:
        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params") or {}

        try:
            if method == "ping":
                result = {
                    "nodriver": uc is not None,
                    "python": sys.version.split()[0],
                    "browser": _find_browser_executable() is not None,
                }
            elif method == "spawn":
                result = await self.spawn(params)
            elif method == "connect":
                result = await self.connect(params)
            elif method == "close":
                result = await self.close(params)
            elif method == "goto":
                result = await self.goto(params)
            elif method == "evaluate":
                result = await self.evaluate(params)
            elif method == "query":
                result = await self.query(params)
            elif method == "click":
                result = await self.click(params)
            elif method == "type":
                result = await self.type_text(params)
            elif method == "upload":
                result = await self.upload(params)
            elif method == "press_key":
                result = await self.press_key(params)
            elif method == "url":
                result = await self.get_url(params)
            elif method == "content":
                result = await self.get_content(params)
            elif method == "set_user_agent":
                result = await self.set_user_agent(params)
            elif method == "authenticate":
                result = await self.authenticate(params)
            elif method == "new_page":
                result = await self.new_page(params)
            elif method == "pages":
                result = await self.pages(params)
            elif method == "wait_for_navigation":
                result = await self.wait_for_navigation(params)
            elif method == "wait_for_function":
                result = await self.wait_for_function(params)
            elif method == "page_type":
                result = await self.page_type(params)
            else:
                raise ValueError(f"Unknown method: {method}")

            return {"id": req_id, "ok": True, "result": result}
        except Exception as exc:
            return {
                "id": req_id,
                "ok": False,
                "error": str(exc),
                "trace": traceback.format_exc(),
            }

    def _session(self, session_id: str) -> BrowserSession:
        if session_id not in self.sessions:
            raise KeyError(f"Session not found: {session_id}")
        return self.sessions[session_id]

    async def spawn(self, params: Dict[str, Any]) -> Dict[str, Any]:
        if uc is None:
            raise RuntimeError("nodriver is not installed. Run: pip install -r requirements.txt")

        session_id = params["sessionId"]
        if session_id in self.sessions:
            await self.close({"sessionId": session_id})

        executable = params.get("executablePath") or _find_browser_executable()
        if not executable:
            raise RuntimeError("No Chrome, Edge, or Opera browser found on this system.")

        user_data_dir = params.get("userDataDir")
        if user_data_dir:
            os.makedirs(user_data_dir, exist_ok=True)

        args = list(params.get("browserArgs") or [])
        stealth_args = [
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-blink-features=AutomationControlled",
        ]
        for arg in stealth_args:
            if arg not in args:
                args.append(arg)

        profile_dir = params.get("profileDirectory")
        if profile_dir:
            args.append(f"--profile-directory={profile_dir}")

        ua = params.get("userAgent")
        if ua:
            args = [a for a in args if not a.startswith("--user-agent=")]
            args.append(f"--user-agent={ua}")

        config = uc.Config(
            headless=bool(params.get("headless")),
            user_data_dir=user_data_dir,
            sandbox=bool(params.get("sandbox", False)),
            browser_executable_path=executable,
            browser_args=args,
        )

        browser = await uc.start(config=config)
        tab = browser.main_tab

        width = int(params.get("viewportWidth") or 1400)
        height = int(params.get("viewportHeight") or 900)
        try:
            await tab.set_window_size(left=0, top=0, width=width, height=height)
        except Exception:
            pass

        self.sessions[session_id] = BrowserSession(session_id, browser, tab)
        return {"sessionId": session_id, "connected": True, "executable": executable}

    async def connect(self, params: Dict[str, Any]) -> Dict[str, Any]:
        if uc is None:
            raise RuntimeError("nodriver is not installed.")

        session_id = params["sessionId"]
        port = int(params.get("debugPort") or 9222)
        host = params.get("host") or "127.0.0.1"

        if session_id in self.sessions:
            await self.close({"sessionId": session_id})

        browser = await Browser.create(host=host, port=port)
        tabs = browser.tabs
        tab = tabs[0] if tabs else await browser.get("about:blank")
        self.sessions[session_id] = BrowserSession(session_id, browser, tab)
        return {"sessionId": session_id, "connected": True, "port": port}

    async def close(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session_id = params["sessionId"]
        session = self.sessions.pop(session_id, None)
        if session:
            await session.close()
        return {"closed": True}

    async def goto(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        url = params["url"]
        timeout_ms = int(params.get("timeout") or 120000)
        wait_until = params.get("waitUntil") or "load"

        tab = session.tab
        await tab.get(url)

        if wait_until in ("networkidle", "networkidle0", "networkidle2"):
            await asyncio.sleep(2.0)
        elif wait_until == "domcontentloaded":
            await asyncio.sleep(0.5)

        deadline = asyncio.get_event_loop().time() + (timeout_ms / 1000.0)
        while asyncio.get_event_loop().time() < deadline:
            current = getattr(tab, "url", None) or ""
            if current and current != "about:blank":
                break
            await asyncio.sleep(0.1)

        return {"url": getattr(tab, "url", "") or ""}

    async def evaluate(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        script = params["script"]
        args = params.get("args") or []
        tab = session.tab

        if args:
            wrapped = (
                f"(function(...__args){{ return ({script})(...__args); }})"
                f"({','.join(json.dumps(a) for a in args)})"
            )
            value = await tab.evaluate(wrapped, await_promise=True, return_by_value=True)
        else:
            value = await tab.evaluate(script, await_promise=True, return_by_value=True)

        return {"value": value}

    async def query(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        selector = params["selector"]
        tab = session.tab
        try:
            element = await tab.select(selector, timeout=5)
            return {"found": element is not None}
        except Exception:
            return {"found": False}

    async def click(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        selector = params["selector"]
        click_count = int(params.get("clickCount") or 1)
        tab = session.tab
        element = await tab.select(selector, timeout=15)
        if element is None:
            raise RuntimeError(f"Element not found: {selector}")
        for _ in range(max(click_count, 1)):
            await element.click()
        return {"clicked": True}

    async def type_text(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        selector = params["selector"]
        text = str(params.get("text") or "")
        delay_ms = int(params.get("delay") or 25)
        tab = session.tab
        element = await tab.select(selector, timeout=15)
        if element is None:
            raise RuntimeError(f"Element not found: {selector}")
        await element.click()
        if delay_ms > 0:
            for ch in text:
                await element.send_keys(ch)
                await asyncio.sleep(delay_ms / 1000.0)
        else:
            await element.send_keys(text)
        return {"typed": True}

    async def page_type(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        selector = params["selector"]
        text = str(params.get("text") or "")
        delay_ms = int(params.get("delay") or 30)
        tab = session.tab
        element = await tab.select(selector, timeout=15)
        if element is None:
            raise RuntimeError(f"Element not found: {selector}")
        await element.click()
        if delay_ms > 0:
            for ch in text:
                await element.send_keys(ch)
                await asyncio.sleep(delay_ms / 1000.0)
        else:
            await element.send_keys(text)
        return {"typed": True}

    async def upload(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        selector = params["selector"]
        file_path = params["filePath"]
        if not os.path.isfile(file_path):
            raise FileNotFoundError(file_path)
        tab = session.tab
        element = await tab.select(selector, timeout=15)
        if element is None:
            raise RuntimeError(f"Element not found: {selector}")
        await element.send_file(file_path)
        return {"uploaded": True}

    async def press_key(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        key = params["key"]
        tab = session.tab
        await tab.send(uc.cdp.input_.dispatch_key_event(
            type_="keyDown",
            key=key,
            code=key,
        ))
        await tab.send(uc.cdp.input_.dispatch_key_event(
            type_="keyUp",
            key=key,
            code=key,
        ))
        return {"pressed": True}

    async def get_url(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        return {"url": getattr(session.tab, "url", "") or ""}

    async def get_content(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        html = await session.tab.get_content()
        return {"content": html or ""}

    async def set_user_agent(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        ua = params["userAgent"]
        await session.tab.send(uc.cdp.network.set_user_agent_override(user_agent=ua))
        return {"ok": True}

    async def authenticate(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        username = params.get("username") or ""
        password = params.get("password") or ""
        await session.tab.send(uc.cdp.fetch.enable(handle_auth_requests=True))
        await session.tab.send(uc.cdp.fetch.continue_with_auth(
            request_id=params.get("requestId", ""),
            auth_challenge_response=uc.cdp.fetch.AuthChallengeResponse(
                response="ProvideCredentials",
                username=username,
                password=password,
            ),
        ))
        return {"ok": True}

    async def new_page(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        tab = await session.browser.get("about:blank", new_tab=True)
        session.tab = tab
        return {"ok": True}

    async def pages(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        count = len(session.browser.tabs or [])
        return {"count": max(count, 1)}

    async def wait_for_navigation(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        timeout_ms = int(params.get("timeout") or 30000)
        start_url = getattr(session.tab, "url", "") or ""
        deadline = asyncio.get_event_loop().time() + (timeout_ms / 1000.0)
        while asyncio.get_event_loop().time() < deadline:
            current = getattr(session.tab, "url", "") or ""
            if current != start_url:
                return {"url": current}
            await asyncio.sleep(0.2)
        return {"url": getattr(session.tab, "url", "") or ""}

    async def wait_for_function(self, params: Dict[str, Any]) -> Dict[str, Any]:
        session = self._session(params["sessionId"])
        script = params["script"]
        timeout_ms = int(params.get("timeout") or 120000)
        deadline = asyncio.get_event_loop().time() + (timeout_ms / 1000.0)
        while asyncio.get_event_loop().time() < deadline:
            value = await session.tab.evaluate(script, await_promise=True, return_by_value=True)
            if value:
                return {"value": True}
            await asyncio.sleep(0.3)
        raise TimeoutError("wait_for_function timed out")


async def read_stdin_lines():
    loop = asyncio.get_event_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            yield {"id": None, "method": "error", "params": {"message": "invalid json"}}


async def main():
    worker = Worker()
    async for req in read_stdin_lines():
        if req.get("method") == "shutdown":
            for sid in list(worker.sessions.keys()):
                await worker.close({"sessionId": sid})
            break
        resp = await worker.handle(req)
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    asyncio.run(main())
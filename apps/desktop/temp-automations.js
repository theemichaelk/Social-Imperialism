const fs = require('fs');
const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Automations Builder - Social Imperialism</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      overflow: hidden;
      display: flex;
      height: 100vh;
    }
    
    /* Sidebar */
    .sidebar {
      width: 250px;
      background-color: #1e293b;
      border-right: 1px solid #334155;
      display: flex;
      flex-direction: column;
      height: 100vh;
      z-index: 10;
    }
    
    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid #334155;
    }
    
    .sidebar-header h2 {
      margin: 0;
      font-size: 1.2rem;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .node-palette {
      padding: 20px;
      flex-grow: 1;
      overflow-y: auto;
    }
    
    .node-category {
      font-size: 0.8rem;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    
    .palette-item {
      background-color: #334155;
      padding: 10px 15px;
      border-radius: 6px;
      margin-bottom: 10px;
      cursor: grab;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      border: 1px solid #475569;
      transition: all 0.2s;
    }
    
    .palette-item:hover {
      background-color: #475569;
      border-color: #38bdf8;
      transform: translateY(-2px);
    }
    
    .palette-item.trigger { border-left: 4px solid #10b981; }
    .palette-item.action { border-left: 4px solid #38bdf8; }
    .palette-item.condition { border-left: 4px solid #f59e0b; }
    .palette-item.delay { border-left: 4px solid #a78bfa; }
    
    /* Main Canvas Area */
    .main-area {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    
    .topbar {
      height: 60px;
      background-color: rgba(30, 41, 59, 0.9);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
      z-index: 10;
    }
    
    .canvas-container {
      flex-grow: 1;
      position: relative;
      background-image: 
        radial-gradient(circle at 1px 1px, #334155 1px, transparent 0);
      background-size: 20px 20px;
      overflow: auto;
    }
    
    #canvas {
      width: 3000px;
      height: 3000px;
      position: relative;
    }
    
    /* Nodes on Canvas */
    .flow-node {
      position: absolute;
      width: 200px;
      background: #1e293b;
      border-radius: 8px;
      border: 1px solid #475569;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      cursor: grab;
      z-index: 5;
      user-select: none;
    }
    
    .flow-node.active {
      border-color: #38bdf8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2), 0 4px 6px rgba(0,0,0,0.3);
    }
    
    .flow-node-header {
      padding: 10px 15px;
      border-bottom: 1px solid #334155;
      font-weight: 600;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 8px;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }
    
    .flow-node.trigger .flow-node-header { background-color: rgba(16, 185, 129, 0.1); color: #10b981; }
    .flow-node.action .flow-node-header { background-color: rgba(56, 189, 248, 0.1); color: #38bdf8; }
    .flow-node.condition .flow-node-header { background-color: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    .flow-node.delay .flow-node-header { background-color: rgba(167, 139, 250, 0.1); color: #a78bfa; }
    
    .flow-node-body {
      padding: 15px;
      font-size: 0.85rem;
      color: #cbd5e1;
    }
    
    .flow-node-ports {
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      pointer-events: none;
    }
    
    .port {
      position: absolute;
      width: 12px;
      height: 12px;
      background: #475569;
      border: 2px solid #0f172a;
      border-radius: 50%;
      pointer-events: auto;
      cursor: crosshair;
      z-index: 6;
      transition: all 0.2s;
    }
    
    .port:hover {
      background: #38bdf8;
      transform: scale(1.2);
    }
    
    .port.in { top: -6px; left: 50%; transform: translateX(-50%); }
    .port.out { bottom: -6px; left: 50%; transform: translateX(-50%); }
    
    /* Connections */
    #svg-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    
    path.connection {
      fill: none;
      stroke: #64748b;
      stroke-width: 3;
      stroke-dasharray: 6 4;
      animation: dash 20s linear infinite;
    }
    
    path.connection.active {
      stroke: #38bdf8;
      stroke-dasharray: none;
      animation: none;
    }
    
    @keyframes dash {
      to { stroke-dashoffset: -100; }
    }
    
    /* Properties Panel */
    .properties-panel {
      position: absolute;
      right: -300px;
      top: 60px;
      width: 300px;
      height: calc(100vh - 60px);
      background-color: #1e293b;
      border-left: 1px solid #334155;
      transition: right 0.3s ease;
      z-index: 20;
      display: flex;
      flex-direction: column;
    }
    
    .properties-panel.open {
      right: 0;
    }
    
    .props-header {
      padding: 15px 20px;
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .props-body {
      padding: 20px;
      flex-grow: 1;
      overflow-y: auto;
    }
    
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-size: 0.85rem; color: #94a3b8; }
    .form-group input, .form-group select {
      width: 100%;
      padding: 8px 10px;
      background: #0f172a;
      border: 1px solid #475569;
      color: white;
      border-radius: 4px;
      box-sizing: border-box;
    }
    
    /* Buttons */
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background-color: #38bdf8;
      color: #0f172a;
    }
    
    .btn-primary:hover { background-color: #0284c7; }
    
    .btn-secondary {
      background-color: transparent;
      border: 1px solid #475569;
      color: #f8fafc;
    }
    
    .btn-secondary:hover { background-color: #334155; }
    
    .btn-danger {
      background-color: transparent;
      border: 1px solid #ef4444;
      color: #ef4444;
    }
    .btn-danger:hover { background-color: rgba(239,68,68,0.1); }
  </style>
</head>
<body>

  <!-- Left Sidebar (Palette) -->
  <div class="sidebar">
    <div class="sidebar-header">
      <h2 onclick="window.location.href='index.html'" style="cursor:pointer;"><i class="fas fa-arrow-left"></i> Flow Builder</h2>
    </div>
    
    <div class="node-palette">
      <div class="node-category">Triggers</div>
      <div class="palette-item trigger" draggable="true" data-type="trigger" data-title="Keyword Match">
        <i class="fas fa-search"></i> Keyword Match
      </div>
      <div class="palette-item trigger" draggable="true" data-type="trigger" data-title="New Follower">
        <i class="fas fa-user-plus"></i> New Follower
      </div>
      <div class="palette-item trigger" draggable="true" data-type="trigger" data-title="Brand Mention">
        <i class="fas fa-at"></i> Brand Mention
      </div>
      
      <div class="node-category" style="margin-top:20px;">Logic & Delay</div>
      <div class="palette-item condition" draggable="true" data-type="condition" data-title="Sentiment Check">
        <i class="fas fa-brain"></i> AI Sentiment
      </div>
      <div class="palette-item delay" draggable="true" data-type="delay" data-title="Wait (Jitter)">
        <i class="fas fa-clock"></i> Wait (Jitter)
      </div>
      
      <div class="node-category" style="margin-top:20px;">Actions</div>
      <div class="palette-item action" draggable="true" data-type="action" data-title="Auto-Like">
        <i class="fas fa-heart"></i> Auto-Like
      </div>
      <div class="palette-item action" draggable="true" data-type="action" data-title="AI Draft Reply">
        <i class="fas fa-robot"></i> AI Draft Reply
      </div>
      <div class="palette-item action" draggable="true" data-type="action" data-title="Auto-Publish Reply">
        <i class="fas fa-paper-plane"></i> Publish Reply
      </div>
      <div class="palette-item action" draggable="true" data-type="action" data-title="Follow User">
        <i class="fas fa-user-check"></i> Follow User
      </div>
    </div>
  </div>

  <!-- Main Canvas -->
  <div class="main-area">
    <div class="topbar">
      <div style="display:flex; align-items:center; gap:15px;">
        <h3 style="margin:0; font-size:1.1rem; font-weight:600;">Campaign Pipeline</h3>
        <span style="background:#10b981; color:#0f172a; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Active</span>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-secondary" onclick="clearCanvas()">Clear All</button>
        <button class="btn btn-primary" onclick="savePipeline()"><i class="fas fa-save"></i> Deploy Flow</button>
      </div>
    </div>
    
    <div class="canvas-container" id="canvasContainer" ondragover="allowDrop(event)" ondrop="drop(event)">
      <div id="canvas">
        <svg id="svg-canvas"></svg>
        <!-- Nodes injected here -->
      </div>
    </div>
    
    <!-- Properties Panel -->
    <div class="properties-panel" id="propPanel">
      <div class="props-header">
        <h3 style="margin:0; font-size:1rem;" id="propTitle">Node Settings</h3>
        <button style="background:none;border:none;color:#94a3b8;cursor:pointer;" onclick="closeProps()"><i class="fas fa-times"></i></button>
      </div>
      <div class="props-body" id="propBody">
        <!-- Dynamic form based on selected node -->
      </div>
      <div style="padding: 20px; border-top: 1px solid #334155;">
        <button class="btn btn-danger" style="width: 100%;" onclick="deleteSelectedNode()">Delete Node</button>
      </div>
    </div>
  </div>

<script>
  // Simple Visual Builder Logic
  const canvas = document.getElementById('canvas');
  const svgCanvas = document.getElementById('svg-canvas');
  const propPanel = document.getElementById('propPanel');
  
  let nodes = {};
  let connections = [];
  let nodeIdCounter = 1;
  let activeNode = null;
  let draggingNode = null;
  let isConnecting = false;
  let connectionStartPort = null;
  let tempPath = null;
  
  // Drag and Drop from Palette
  document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: item.dataset.type,
        title: item.dataset.title,
        icon: item.querySelector('i').className
      }));
    });
  });
  
  function allowDrop(e) { e.preventDefault(); }
  
  function drop(e) {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const containerRect = document.getElementById('canvasContainer').getBoundingClientRect();
    
    // Adjust for scroll
    const scrollX = document.getElementById('canvasContainer').scrollLeft;
    const scrollY = document.getElementById('canvasContainer').scrollTop;
    
    const x = e.clientX - containerRect.left + scrollX - 100;
    const y = e.clientY - containerRect.top + scrollY - 30;
    
    createNode(data.type, data.title, data.icon, x, y);
  }
  
  function createNode(type, title, icon, x, y, id = null, config = {}) {
    const nodeId = id || 'node_' + nodeIdCounter++;
    
    const nodeEl = document.createElement('div');
    nodeEl.className = "flow-node " + type;
    nodeEl.id = nodeId;
    nodeEl.style.left = x + "px";
    nodeEl.style.top = y + "px";
    
    // Config logic
    let desc = "Configure this step";
    if(type === 'trigger') desc = "Listens for events";
    if(type === 'action') desc = "Executes an API call";
    if(type === 'delay') desc = "Waits before continuing";
    if(type === 'condition') desc = "Splits logic path";
    
    nodeEl.innerHTML = '<div class="flow-node-header"><i class="' + icon + '"></i> ' + title + '</div>' +
      '<div class="flow-node-body">' + desc + '</div>' +
      '<div class="flow-node-ports">' +
        (type !== 'trigger' ? '<div class="port in" data-port="in"></div>' : '') +
        (type !== 'action' ? '<div class="port out" data-port="out"></div>' : '') +
      '</div>';
    
    canvas.appendChild(nodeEl);
    
    nodes[nodeId] = { id: nodeId, type, title, x, y, config: config, el: nodeEl };
    
    // Interactions
    nodeEl.addEventListener('mousedown', (e) => startNodeDrag(e, nodeId));
    nodeEl.addEventListener('click', (e) => selectNode(nodeId, e));
    
    // Port Connections
    nodeEl.querySelectorAll('.port').forEach(port => {
      port.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if(port.classList.contains('out')) startConnection(nodeId, e);
      });
      port.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if(port.classList.contains('in') && isConnecting && connectionStartPort !== nodeId) {
          completeConnection(nodeId);
        }
      });
    });
    
    return nodeId;
  }
  
  // Dragging nodes
  let dragOffset = {x: 0, y: 0};
  function startNodeDrag(e, id) {
    if(e.target.classList.contains('port')) return;
    draggingNode = id;
    const rect = nodes[id].el.getBoundingClientRect();
    
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    document.addEventListener('mousemove', dragNode);
    document.addEventListener('mouseup', stopNodeDrag);
  }
  
  function dragNode(e) {
    if(!draggingNode) return;
    const containerRect = document.getElementById('canvasContainer').getBoundingClientRect();
    const scrollX = document.getElementById('canvasContainer').scrollLeft;
    const scrollY = document.getElementById('canvasContainer').scrollTop;
    
    const x = e.clientX - containerRect.left + scrollX - dragOffset.x;
    const y = e.clientY - containerRect.top + scrollY - dragOffset.y;
    
    nodes[draggingNode].x = x;
    nodes[draggingNode].y = y;
    nodes[draggingNode].el.style.left = x + "px";
    nodes[draggingNode].el.style.top = y + "px";
    
    updateConnections();
  }
  
  function stopNodeDrag() {
    draggingNode = null;
    document.removeEventListener('mousemove', dragNode);
    document.removeEventListener('mouseup', stopNodeDrag);
  }
  
  // Connections (SVG Lines)
  function startConnection(startNodeId, e) {
    isConnecting = true;
    connectionStartPort = startNodeId;
    
    tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.classList.add('connection');
    svgCanvas.appendChild(tempPath);
    
    document.addEventListener('mousemove', drawTempConnection);
    document.addEventListener('mouseup', cancelConnection);
  }
  
  function drawTempConnection(e) {
    if(!isConnecting) return;
    const containerRect = document.getElementById('canvasContainer').getBoundingClientRect();
    const scrollX = document.getElementById('canvasContainer').scrollLeft;
    const scrollY = document.getElementById('canvasContainer').scrollTop;
    
    const startNode = nodes[connectionStartPort];
    const startX = startNode.x + 100;
    const startY = startNode.y + startNode.el.offsetHeight;
    
    const endX = e.clientX - containerRect.left + scrollX;
    const endY = e.clientY - containerRect.top + scrollY;
    
    // Bezier curve
    const d = "M " + startX + " " + startY + " C " + startX + " " + (startY + 50) + ", " + endX + " " + (endY - 50) + ", " + endX + " " + endY;
    tempPath.setAttribute('d', d);
  }
  
  function completeConnection(endNodeId) {
    if(!isConnecting || !connectionStartPort) return;
    
    // Check if exists
    if(!connections.find(c => c.from === connectionStartPort && c.to === endNodeId)) {
      connections.push({ from: connectionStartPort, to: endNodeId });
      drawConnections();
    }
    
    cleanupConnection();
  }
  
  function cancelConnection() {
    cleanupConnection();
  }
  
  function cleanupConnection() {
    isConnecting = false;
    connectionStartPort = null;
    if(tempPath) {
      tempPath.remove();
      tempPath = null;
    }
    document.removeEventListener('mousemove', drawTempConnection);
    document.removeEventListener('mouseup', cancelConnection);
  }
  
  function drawConnections() {
    svgCanvas.innerHTML = ''; // clear all
    connections.forEach(conn => {
      const fromNode = nodes[conn.from];
      const toNode = nodes[conn.to];
      
      if(!fromNode || !toNode) return;
      
      const startX = fromNode.x + 100;
      const startY = fromNode.y + fromNode.el.offsetHeight;
      const endX = toNode.x + 100;
      const endY = toNode.y;
      
      const d = "M " + startX + " " + startY + " C " + startX + " " + (startY + 50) + ", " + endX + " " + (endY - 50) + ", " + endX + " " + endY;
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.classList.add('connection', 'active');
      svgCanvas.appendChild(path);
    });
  }
  
  function updateConnections() {
    if(connections.length > 0) drawConnections();
  }
  
  // Properties Panel
  function selectNode(id, e) {
    if(e) e.stopPropagation();
    
    document.querySelectorAll('.flow-node').forEach(n => n.classList.remove('active'));
    nodes[id].el.classList.add('active');
    activeNode = id;
    
    const node = nodes[id];
    document.getElementById('propTitle').innerText = node.title + " Settings";
    
    let html = '';
    if(node.type === 'trigger') {
      html = '<div class="form-group"><label>Target Platform</label><select id="cfg_platform" onchange="updateNodeConfig()">' +
             '<option value="Any" ' + (node.config.platform === 'Any' ? 'selected' : '') + '>Any Attached Platform</option>' +
             '<option value="Twitter" ' + (node.config.platform === 'Twitter' ? 'selected' : '') + '>Twitter / X</option>' +
             '<option value="LinkedIn" ' + (node.config.platform === 'LinkedIn' ? 'selected' : '') + '>LinkedIn</option>' +
             '</select></div>' +
             '<div class="form-group"><label>Match Type</label><select id="cfg_match" onchange="updateNodeConfig()">' +
             '<option value="Exact" ' + (node.config.match === 'Exact' ? 'selected' : '') + '>Exact Keyword</option>' +
             '<option value="Semantic" ' + (node.config.match === 'Semantic' ? 'selected' : '') + '>AI Semantic Match</option>' +
             '</select></div>';
    } else if(node.type === 'delay') {
      html = '<div class="form-group"><label>Wait Duration (Minutes)</label><input type="number" id="cfg_delay" value="' + (node.config.delay || 15) + '" onchange="updateNodeConfig()"></div>' +
             '<div class="form-group"><label>Randomize Jitter (+/- Mins)</label><input type="number" id="cfg_jitter" value="' + (node.config.jitter || 5) + '" onchange="updateNodeConfig()"></div>';
    } else if(node.type === 'action') {
      html = '<div class="form-group"><label>Select Account</label><select id="cfg_account" onchange="updateNodeConfig()"><option value="Auto">Auto (Contextual)</option></select></div>';
    } else if(node.type === 'condition') {
      html = '<div class="form-group"><label>Condition Rule</label><select id="cfg_rule" onchange="updateNodeConfig()">' +
             '<option value="Positive">Is Positive Sentiment</option>' +
             '<option value="Negative">Is Negative Complaint</option>' +
             '<option value="Question">Is Asking a Question</option>' +
             '</select></div>';
    }
    
    document.getElementById('propBody').innerHTML = html;
    propPanel.classList.add('open');
  }
  
  window.updateNodeConfig = function() {
    if(!activeNode) return;
    const node = nodes[activeNode];
    
    if(document.getElementById('cfg_platform')) node.config.platform = document.getElementById('cfg_platform').value;
    if(document.getElementById('cfg_match')) node.config.match = document.getElementById('cfg_match').value;
    if(document.getElementById('cfg_delay')) node.config.delay = document.getElementById('cfg_delay').value;
    if(document.getElementById('cfg_jitter')) node.config.jitter = document.getElementById('cfg_jitter').value;
    if(document.getElementById('cfg_account')) node.config.account = document.getElementById('cfg_account').value;
    if(document.getElementById('cfg_rule')) node.config.rule = document.getElementById('cfg_rule').value;
  };
  
  window.closeProps = function() {
    propPanel.classList.remove('open');
    if(activeNode) nodes[activeNode].el.classList.remove('active');
    activeNode = null;
  };
  
  window.deleteSelectedNode = function() {
    if(!activeNode) return;
    nodes[activeNode].el.remove();
    connections = connections.filter(c => c.from !== activeNode && c.to !== activeNode);
    delete nodes[activeNode];
    closeProps();
    drawConnections();
  };
  
  window.clearCanvas = function() {
    if(confirm("Clear the entire pipeline canvas?")) {
      Object.values(nodes).forEach(n => n.el.remove());
      nodes = {};
      connections = [];
      closeProps();
      drawConnections();
    }
  };
  
  window.savePipeline = function() {
    const pipelineData = {
      nodes: Object.values(nodes).map(n => ({ id: n.id, type: n.type, title: n.title, config: n.config, pos: {x: n.x, y: n.y} })),
      edges: connections
    };
    
    try {
      localStorage.setItem('customAutomationsFlow', JSON.stringify(pipelineData));
      alert("Pipeline deployed successfully! The background worker will now execute this flow logic.");
    } catch(e) {
      alert("Failed to save pipeline.");
    }
  };
  
  // Deselect on canvas click
  document.getElementById('canvasContainer').addEventListener('click', (e) => {
    if(e.target === document.getElementById('canvasContainer') || e.target === document.getElementById('canvas')) {
      closeProps();
    }
  });
  
  // Initial example nodes
  setTimeout(() => {
    const n1 = createNode('trigger', 'Keyword Match', 'fas fa-search', 200, 100);
    const n2 = createNode('delay', 'Wait (Jitter)', 'fas fa-clock', 200, 300, null, {delay: 10, jitter: 5});
    const n3 = createNode('action', 'AI Draft Reply', 'fas fa-robot', 200, 500);
    
    connections.push({from: n1, to: n2});
    connections.push({from: n2, to: n3});
    drawConnections();
  }, 500);

</script>
</body>
</html>`;

fs.writeFileSync('automations.html', content);
console.log("Visual Automations Builder Created");
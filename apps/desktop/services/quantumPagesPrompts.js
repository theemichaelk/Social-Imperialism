/**
 * Quantum Pages SEO — multi-step article pipeline prompt definitions.
 * Placeholders: {!keyword}, {!business_details}, {!output-N}, {!output-AuthLinks},
 * {!content-output}, !number_of_images
 */

const SECTION_COPY_SYSTEM = `You are an AI assistant specializing in SEO copywriting for business blogs. Your role is to create comprehensive, search-optimized content that follows specified outlines while maintaining authentic business voice and style.

**Core Objectives:**
- Create in-depth, SEO-optimized content that ranks well and provides substantial reader value
- Maintain authentic business voice using provided business details and writing style
- Ensure content flows cohesively as part of a larger article structure

**Article Structure Guidelines:**

**Headings:**
- Never use "Section 1" or "Section 2" in actual headings
- Follow each h2, h3, and h4 heading with 2-4 paragraphs of relevant, informative content
- Maintain logical flow and content relevance between headings

**Content Formatting:**

**Paragraphs:**
- Use <p> tags for all paragraphs
- Keep paragraphs approximately 3 sentences long
- Provide 2-4 paragraphs under each heading/subheading for thorough topic coverage

**Emphasis and SEO:**
- Use <strong>, <em>, and <u> tags strategically for important terms and SEO keywords
- Include at least one form of emphasis in every other paragraph
- Emphasize 1-2 SEO-optimized keywords per section
- Focus on readability and natural keyword integration

**Lists (Priority Requirement):**
- Use <ul>/<li> for unordered lists and <ol>/<li> for ordered lists
- **Mandatory:** Include at least one list in every <h2> section
- **Mandatory:** Include lists in <h3> subsections where applicable
- Prioritize lists over paragraphs when presenting multiple items, steps, features, or examples

**Tables:**
- Include tables using <table>, <tr>, <th>, and <td> tags when presenting comparative or structured data

**Writing Style Requirements:**

**Voice and Tone:**
- Write in first person perspective
- Inherit writing style from the provided business details section
- Use conversational, approachable tone that matches the business personality
- Avoid superlatives, futuristic language, and robotic phrasing

**Readability:**
- Write at a 5th-grade reading level
- Use mix of sentence lengths for natural flow (burstiness)
- Ensure content passes AI detection tools

**Personalization:**
- Naturally incorporate business name, owner's name, or personal insights from business details

**Business Details and Writing Style:**
"{!business_details}"

**Output Format:**
Provide content in clean HTML format suitable for direct integration:
- Use proper heading hierarchy (h2, h3, h4)
- No <body>, <html>, or <section> wrapper tags`;

const QUANTUM_STEPS = [
  {
    id: '1',
    label: 'SEO competitor report',
    model: 'perplexity/sonar',
    maxTokens: 1500,
    temperature: 0.8,
    system: 'You are an advanced AI assistant with expertise in SEO, digital marketing, content creation, keyword research, and data analysis. When provided with a keyword or topic, you will conduct thorough research, analyze relevant content and create a report for this keyword.',
    user: `You are a skilled SEO analyst. Conduct a Google search for my keyword "{!keyword}" and analyze the top-ranking websites.

Please provide a brief analysis covering the following:

1. Search Intent: Identify the primary search intent (informational, navigational, transactional, or commercial investigation) and any relevant sub-intents.
2. Content Themes: Summarize the main themes and unique angles from the top articles.
3. Keyword Overview: List primary and LSI, NLP and entity keywords used.
4. Headings Structure: Describe the hierarchy of headings (H1, H2, H3) and how keywords are integrated.
5. Content Gaps: Highlight significant unaddressed topics and opportunities for differentiation.
6. Optimization Suggestions: Provide 2-3 actionable recommendations for creating an optimized article outline.
7. Content Length and Structure: calculate the Average Word Count, the Content Depth and Structural Elements utilized in the articles.

Keep your response concise, focusing on actionable insights`,
    serpGrounding: true,
  },
  {
    id: '2',
    label: 'Article outline',
    model: 'openai/gpt-4o-mini',
    maxTokens: 5000,
    temperature: 0.8,
    system: 'You are an AI assistant with expertise in SEO and copywriting. Create an optimized blog post outline for the specified keyword that thoroughly addresses all key points mentioned in the report. Divide into Section 1 (intro + body) and Section 2 (conclusion/CTA) wrapped in <section id="1"> and <section id="2">. Each section must contain at least two <h2> tags. Use only <h2>, <h3>, <h4>. Output only the outline.',
    user: `Here's the report for the keyword "{!keyword}":

"{!output-1}"

Using the insights provided in the report, please create a comprehensive and SEO-optimized article outline for the keyword "{!keyword}."

Requirements: keyword-rich headings, address content gaps, conversational credible tone, avoid superlatives (Discover, Master, Ultimate, Unlock). Focus on what readers want to know. Provide only the optimized outline without additional commentary.`,
  },
  {
    id: '3',
    label: 'Entity extraction',
    model: 'openai/gpt-4o-mini',
    maxTokens: 5000,
    temperature: 0.8,
    system: 'You are an entity extraction tool. Your task is to identify and list the top entities associated with a specific keyword. Ensure the list is concise, relevant, and strictly adheres to the user\'s request for only the entities.',
    user: 'Generate a list of the top 50 entities related to the keyword {!keyword}. Please provide only the list of entities without any additional commentary. If possible, perform a search to identify the most relevant entities that could help my article rank higher on Google for this keyword.',
  },
  {
    id: '4',
    label: 'Entity-enhanced outline',
    model: 'openai/gpt-4o-mini',
    maxTokens: 5000,
    temperature: 0.8,
    system: 'You are a content outline specialist with expertise in SEO and user intent. Enhance the outline by strategically incorporating valuable entities while maintaining the original structure. Wrap sections in <section id="1"> and <section id="2">. Deliver only the final updated outline.',
    user: `Below is my article outline along with top entities. Add new sections incorporating important entities without altering existing structure. Provide only the final updated outline.

**Article Outline:**
"{!output-2}"

**List of Entities:**
"{!output-3}"`,
  },
  {
    id: '5',
    label: 'Write Section 1',
    model: 'openai/gpt-4o-mini',
    maxTokens: 7000,
    temperature: 0.8,
    system: SECTION_COPY_SYSTEM,
    user: `Please write Section 1 of the article using the provided outline and business details.

**Article Outline:**
<outline>
  "{!output-4}"
</outline>

**Important:** Write only Section 1 content. Do not include any other sections.`,
  },
  {
    id: '6',
    label: 'Write Section 2',
    model: 'openai/gpt-4o-mini',
    maxTokens: 7000,
    temperature: 0.99,
    system: SECTION_COPY_SYSTEM,
    user: `Please write Section 2 of the article using the provided outline and business details.

**Article Outline:**
<outline>
  "{!output-4}"
</outline>

**Important:** Write only Section 2 content. Do not include any other sections.`,
  },
  {
    id: '7',
    label: 'Meta title',
    model: 'openai/gpt-4o-mini',
    maxTokens: 2500,
    temperature: 0.7,
    system: 'You are an experienced SEO professional and copywriter',
    user: `Create a SEO Optimized Meta title for a blog post that Has the following title: "{!keyword}"
Optimize the title for CTR. Avoid superlatives and robotic language. Provide the Meta title only.`,
  },
  {
    id: '8',
    label: 'Meta description',
    model: 'openai/gpt-4o-mini',
    maxTokens: 2500,
    temperature: 0.7,
    system: 'You are an experienced SEO professional and copywriter',
    user: `Create a meta description for my blog post about "{!keyword}" with meta title "{!output-7}". The meta description should be 160 characters. Avoid superlatives. Provide the meta description only.`,
  },
  {
    id: '9',
    label: 'Key takeaways',
    model: 'openai/gpt-4o-mini',
    maxTokens: 16300,
    temperature: 0.8,
    system: 'You are an experienced SEO professional and copywriter specializing in creating engaging, scannable content with Bootstrap 4 HTML.',
    user: `Extract key takeaways from the article and format in HTML with Bootstrap 4 classes. Include engaging intro and "What You Will Learn" section.

Article:
##{!output-5}
{!output-6}##

Website Brand Colors:
"{!business_details}"

Output the section only.`,
  },
  {
    id: '10',
    label: 'Recap section',
    model: 'openai/gpt-4o-mini',
    maxTokens: 16300,
    temperature: 0.7,
    system: 'You are an experienced SEO professional and copywriter',
    user: `Create a recap/best practices section in HTML with Bootstrap 4 for the end of the article.

Article:
##{!output-5}
{!output-6}##

Website Brand Colors:
"{!business_details}"

Output the section only.`,
  },
  {
    id: '11',
    label: 'Mid-article engagement',
    model: 'openai/gpt-4o-mini',
    maxTokens: 16300,
    temperature: 0.7,
    system: 'You are an experienced SEO professional and copywriter',
    user: `Create a mid-article engagement section (Quick Summary, Pro Tip, Quote, or Poll) in HTML with Bootstrap 4.

Article:
##{!output-5}
{!output-6}##

Website Brand Colors:
"{!business_details}"

Output the section only.`,
  },
  {
    id: '12',
    label: 'YouTube embed',
    model: 'perplexity/sonar',
    maxTokens: 1500,
    temperature: 0.8,
    system: 'You are a helpful AI assistant that can search YouTube for videos. Find a live, viewable, embeddable English-language video and output embed code using the provided HTML template.',
    user: `Find a suitable YouTube video related to "{!keyword}" and provide the embed code using this format with {video_id} and {video_title} replaced. Provide embed code only.

"<p><div class=\\"embed-responsive embed-responsive-16by9 mx-auto\\"><iframe src=\\"https://www.youtube.com/embed/{video_id}?autoplay=1\\" frameborder=\\"0\\" allowfullscreen title=\\"{video_title}\\"></iframe></div></p>"`,
  },
  {
    id: '15',
    label: 'Visual infographic',
    model: 'google/gemini-2.5-flash',
    maxTokens: 16300,
    temperature: 0.8,
    system: 'You are highly skilled in SEO, Marketing, and writing clean conflict-free HTML/CSS with unique containers and inline CSS.',
    user: `Extract statistical data from the article and create a visual HTML representation with inline CSS in a unique container (max-width 90%, max 2 columns).

Article:
##
{!output-5}
{!output-6}
##

Business Details (Extract Color Palette Only):
"{!business_details}"

Provide HTML with inline CSS only. Do not explain what you are doing.`,
  },
  {
    id: '16',
    label: 'Short blog title',
    model: 'openai/gpt-4o-mini',
    maxTokens: 2300,
    temperature: 0.8,
    system: 'You are an experienced SEO professional and copywriter',
    user: `Create a blog post title that is 5 words or less for a post about "{!keyword}". Avoid superlatives. Provide the title only.`,
  },
  {
    id: 'AuthLinks',
    label: 'Authority links',
    model: 'perplexity/sonar',
    maxTokens: 1500,
    temperature: 0.8,
    system: 'You are an expert research specialist identifying high-authority online sources (.gov, .edu, established .org, industry leaders).',
    user: `Find exactly 3 high-authority sources relevant to this article topic: '{!output-16}'

Provide only the 3 URLs, one per line, with no additional text.`,
    outputKey: 'AuthLinks',
  },
  {
    id: '17',
    label: 'Featured image prompt',
    model: 'openai/gpt-4o-mini',
    maxTokens: 16300,
    temperature: 0.8,
    system: 'You are an experienced SEO professional and copywriter',
    user: `Generate an image prompt for a featured image for blog post titled "{!output-7}". Realistic, high-quality, clean composition, no text overlays. Provide the image generation prompt only.`,
  },
  {
    id: '19',
    label: 'Proofread + FAQs',
    model: 'google/gemini-2.5-flash',
    maxTokens: 16300,
    temperature: 0.8,
    system: 'You are an experienced SEO professional and copywriter',
    user: `Proofread the article, fix grammar, add FAQs, embed authority links naturally. Return complete HTML ready for publishing.

Article:
##
{!output-9}
{!output-15}
{!output-5}
{!output-12}
{!output-11}
{!output-6}
{!output-10}
##

Authority source URLs:
"{!output-AuthLinks}"

Output the entire article without leaving anything out. No commentary.`,
  },
];

const CONTENT_AI_IMAGES = {
  model: 'openai/gpt-4o-mini',
  maxTokens: 16300,
  temperature: 0.8,
  system: `**CONTENT PRESERVATION RULE #1: NEVER modify, rewrite, summarize, or remove ANY original content. Your ONLY job is to insert image placeholders and generate image generation prompts.**

Always output compact JSON with BOTH html_output AND images_prompt_array. Escape quotes in HTML attributes. No line breaks in html_output string.`,
  userTemplate: `# TASK: Insert Exactly !number_of_images Images

Analyze the article and insert exactly !number_of_images image placeholders with float styles. Preserve ALL original content exactly.

Current article content: "{!content-output}"

Output ONLY valid compact JSON: {"html_output":"...","images_prompt_array":[{"src_of_image":"assets/media/image1.webp","prompt":"...","image_type":"image/webp","width":"400","height":"300"}]}`,
};

const PIPELINE_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '16', 'AuthLinks', '17', '19'];

function getStepById(id) {
  return QUANTUM_STEPS.find((s) => s.id === id);
}

function getPipelineSteps() {
  return PIPELINE_ORDER.map((id) => {
    const step = getStepById(id);
    return step ? { id: step.id, label: step.label, model: step.model } : null;
  }).filter(Boolean);
}

module.exports = {
  QUANTUM_STEPS,
  PIPELINE_ORDER,
  CONTENT_AI_IMAGES,
  getStepById,
  getPipelineSteps,
};
import {
  getLinkInstruction,
  getReadabilityInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchYoutubeVideoData
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

export async function generateYoutubeBlogOutline(body, genAI) {
  const { prompt, settings } = body;
  const {
    model, targetKeyword, language, country, youtubeUrl, enableCaptionRewriting } = settings;

  // 1. Fetch the YouTube Transcript
  const videoData = await fetchYoutubeVideoData(youtubeUrl);
  if (!videoData.success) {
    throw new Error('Failed to fetch YouTube transcript. The video might be private or lacking captions.');
  }

  const transcript = videoData.transcript || videoData.text || '';
  const videoTitle = videoData.title || 'YouTube Video';

  const langObj = languages ? languages[language] : null;
  const langName = langObj ? langObj.name : (language || 'English');
  const countryObj = countries ? countries.find(c => c.code === country) : null;
  const countryName = countryObj ? countryObj.name : (country || 'United States');

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: "application/json" },
     systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with two keys: "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }`
  });

  // 2. Handle "Enable Rewriting" Logic based on the UI toggle name
  const rewriteInstruction = enableCaptionRewriting
    ? `REWRITING ENABLED: Use the video transcript as your core inspiration, but creatively restructure it into a standalone, highly engaging blog post. You do not need to follow the video's exact chronological order. Add logical headings that make it a better reading experience.`
    : `STRICT ADHERENCE: Closely follow the chronological flow, exact arguments, and structure of the video. Your outline should act as a direct text adaptation of the video's timeline.`;

  const outlinePrompt = `
    Target Keyword/Topic: ${targetKeyword || prompt}
    Original Video Title: ${videoTitle}

    Video Transcript for Context:
    ${transcript.substring(0, 200000)}

    TASK: Create a comprehensive blog post outline based STRICTLY on the content of the provided transcript.
    CRITICAL EXECUTION INSTRUCTIONS:
    1. Strict Source Grounding: Your content MUST be strictly grounded in the provided source video transcript. Extract facts, numbers, and context entirely from the transcript. Do not invent outside information.
    2. Cross-Lingual Adaptation: If the source transcript is in a different language than the Target Output Language (${langName}), translate the core meaning and details accurately. Ensure the final output reads natively in ${langName}.
    3. Granular Detail Extraction: Mine the transcript for specific entities (names, prices, locations, material descriptions, direct quotes). Use these to make the section highly authentic.
    ${rewriteInstruction}

    CRITICAL STRUCTURE REQUIREMENTS:
    1. Length: You MUST generate between 8 and 12 main H2 sections.
    2. Depth: For every H2, you MUST include 2 to 3 related H3 subheadings in the array to provide depth.
    3. Flatness: Keep the JSON array flat (no nesting).
  `;

  const result = await outlineModel.generateContent(outlinePrompt);
  const parsedData = JSON.parse(result.response.text());

  // FIX #1: Flattening the payload so it matches standard.js perfectly
  return {
    success: true,
    title: parsedData.title,
    outline: parsedData.outline,
    fetchedTranscript: transcript,
    fetchedVideoTitle: videoTitle
  };
}


export async function generateYoutubeBlogSection(body, genAI) {
  // FIX #2: Extracting variables correctly from the unified `body` object
  const {
    outlineContext,
    heading,
    subheadings,
    fetchedTranscript,
    fetchedVideoTitle,
    settings = {},
    externalLinks,
    internalLinks,
  } = body;

  let transcriptText = fetchedTranscript || '';

  const {
    model, targetKeyword, toneOfVoice, customToneOfVoice,
    pointOfView, useRealTimeSearchData, realTimeDataSource,
    seoOptimization, manualKeywords, improveReadability, enableCaptionRewriting, deepSearch, language, country
  } = settings;


  const langObj = languages ? languages[language] : null;
  const langName = langObj ? langObj.name : (language || 'English');
  const countryObj = countries ? countries.find(c => c.code === country) : null;
  const countryName = countryObj ? countryObj.name : (country || 'United States');

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const modelConfig = {
    model: deepSearch ? 'deep-research-preview-04-2026' : (model || 'gemini-2.5-pro'),
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
  }

  const isWebSearch = !realTimeDataSource || realTimeDataSource === 'search';
  if (useRealTimeSearchData && isWebSearch) {
    modelConfig.tools = [{
      googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 } }
    }];
  }

  const sectionModel = genAI.getGenerativeModel(modelConfig);

  // 3. Ensuring helper arguments match your helpers.js signature
  let linkInstruction = getLinkInstruction(internalLinks);
  let seoInstruction = await getSeoInstruction(seoOptimization, manualKeywords, targetKeyword);

  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);
  let povInstruction = getPovInstruction(pointOfView);
  let readabilityInstruction = getReadabilityInstruction(improveReadability);

let sectionStructureRequirements = `
          CRITICAL STRUCTURE & FORMATTING REQUIREMENTS:
          1. DO NOT output the H2 heading "${heading}" as text in your response. Start immediately with a strong, engaging introductory paragraph for this section.
          ${subheadings && subheadings.length > 0 ? `2. You MUST cover the following subheadings exactly as Markdown H3s (### [Title]):\n${subheadings.join('\n')}` : '2. Write the content directly without adding any new H3 subheadings.'}
          3. Format beautifully: Use bolding (**text**) for key terms, use bulleted lists for data, and keep paragraphs short (2-4 sentences max) for high web readability.
        `;

  const rewriteInstruction = enableCaptionRewriting
    ? `Approach this section as an expert author writing an original piece inspired by the video content. Add depth where necessary.`
    : `Extract and summarize the information exactly as it was presented in the video for this specific section. Do not add outside information.`;

  const sectionPrompt = `
        Article Topic Context: ${targetKeyword}
        Original Video Title: ${fetchedVideoTitle || 'YouTube Video'}
        Full Article Outline for Context: ${JSON.stringify(outlineContext)}

        SOURCE VIDEO TRANSCRIPT:
        ${transcriptText ? transcriptText.substring(0, 200000) : 'No transcript provided.'}

        TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".
        CRITICAL EXECUTION INSTRUCTIONS:
        1. Strict Source Grounding: Your content MUST be strictly grounded in the provided source video transcript. Extract facts, numbers, and context entirely from the transcript. Do not invent outside information.
        2. Cross-Lingual Adaptation: If the source transcript is in a different language than the Target Output Language (${langName}), translate the core meaning and details accurately. Ensure the final output reads natively in ${langName}.
        3. Granular Detail Extraction: Mine the transcript for specific entities (names, prices, locations, material descriptions, direct quotes). Use these to make the section highly authentic.

        ${rewriteInstruction}

        ${sectionStructureRequirements}
        ${linkInstruction}
        ${seoInstruction}
        ${toneInstruction}
        ${povInstruction}
        ${readabilityInstruction}
      `;

  const result = await sectionModel.generateContent(sectionPrompt);

  return { success: true, text: result.response.text(), mediaHtml: assignedMediaElement };
}

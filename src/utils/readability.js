import readability from 'text-readability'

export function analyzeContent(text) {
  return {
    wordCount: text.split(/\s+/).filter(Boolean).length,
    fleschReadingEase: readability.fleschReadingEase(text),
    fleschKincaidGrade: readability.fleschKincaidGradeLevel(text),
    readingTimeMinutes: Math.ceil(text.split(/\s+/).filter(Boolean).length / 200)
  }
}

import { describe, expect, it } from 'vitest'
import { createMoodParser } from './moodParser'

function run(chunks: string[]): { text: string; mood: string; visibleAtEachStep: string[] } {
  const parser = createMoodParser()
  let text = ''
  const visibleAtEachStep: string[] = []
  for (const chunk of chunks) {
    text += parser.push(chunk)
    visibleAtEachStep.push(text)
  }
  const end = parser.finish()
  return { text: text + end.text, mood: end.mood, visibleAtEachStep }
}

describe('createMoodParser', () => {
  it('retire la balise et donne son humeur', () => {
    const { text, mood } = run(['Bonjour !\n\n[mood:happy]'])
    expect(text).toBe('Bonjour !')
    expect(mood).toBe('happy')
  })

  it('ne laisse jamais paraître une balise coupée entre deux fragments', () => {
    const { text, mood, visibleAtEachStep } = run(['Voilà.', '\n', '[mo', 'od:so', 'rry', ']'])
    expect(text).toBe('Voilà.')
    expect(mood).toBe('sorry')
    for (const visible of visibleAtEachStep) expect(visible).not.toContain('[')
  })

  it('coupe caractère par caractère sans rien perdre', () => {
    const source = 'Un **texte** avec [un lien](https://a.b).\n[mood:surprised]'
    const { text, mood } = run([...source])
    expect(text).toBe('Un **texte** avec [un lien](https://a.b).')
    expect(mood).toBe('surprised')
  })

  it('rend les crochets ordinaires dès que ce n\'est plus une balise', () => {
    const { text, visibleAtEachStep } = run(['tableau[', 'i] = 2'])
    expect(text).toBe('tableau[i] = 2')
    expect(visibleAtEachStep[0]).toBe('tableau')
  })

  it('garde les espaces entre les mots d\'un fragment à l\'autre', () => {
    expect(run(['Bonjour ', 'à ', 'toi']).text).toBe('Bonjour à toi')
  })

  it('donne neutral sans balise', () => {
    expect(run(['Rien de spécial.']).mood).toBe('neutral')
  })

  it('retire aussi une humeur inconnue, sans l\'appliquer', () => {
    const { text, mood } = run(['Oups.\n[mood:angry]'])
    expect(text).toBe('Oups.')
    expect(mood).toBe('neutral')
  })

  it('rend un début de balise resté sans suite', () => {
    expect(run(['Fin [mood']).text).toBe('Fin [mood')
  })
})

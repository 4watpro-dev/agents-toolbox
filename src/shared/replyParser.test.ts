import { describe, expect, it } from 'vitest'
import { createReplyParser } from './replyParser'

function run(chunks: string[]): { text: string; mood: string; visibleAtEachStep: string[] } {
  const parser = createReplyParser()
  let text = ''
  const visibleAtEachStep: string[] = []
  for (const chunk of chunks) {
    text += parser.push(chunk)
    visibleAtEachStep.push(text)
  }
  const end = parser.finish()
  return { text: text + end.text, mood: end.mood, visibleAtEachStep }
}

describe('createReplyParser', () => {
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

describe('balise de mémoire', () => {
  function parse(chunks: string[]) {
    const parser = createReplyParser()
    let text = ''
    const steps: string[] = []
    for (const chunk of chunks) {
      text += parser.push(chunk)
      steps.push(text)
    }
    const end = parser.finish()
    return { text: text + end.text, mood: end.mood, facts: end.facts, steps }
  }

  it('retire le fait du texte et le rend avec l\'humeur', () => {
    const { text, mood, facts } = parse(['Noté !\n[remember:Travaille à Brest]\n[mood:happy]'])
    expect(text).toBe('Noté !')
    expect(mood).toBe('happy')
    expect(facts).toEqual(['Travaille à Brest'])
  })

  it('ne laisse jamais paraître un fait coupé en morceaux', () => {
    const { text, facts, steps } = parse(['Noté.', '\n[rem', 'ember:Préfère ', 'le thé', ']', '\n[mood:neutral]'])
    expect(text).toBe('Noté.')
    expect(facts).toEqual(['Préfère le thé'])
    for (const step of steps) expect(step).not.toContain('[')
  })

  it('accepte plusieurs faits', () => {
    expect(parse(['A\n[remember:un]\n[remember:deux]']).facts).toEqual(['un', 'deux'])
  })

  it('ignore un fait vide', () => {
    expect(parse(['A [remember:   ]']).facts).toEqual([])
  })

  it('rend un texte qui commence seulement comme une balise', () => {
    expect(parse(['voir [rem', 'arque] ici']).text).toBe('voir [remarque] ici')
  })
})

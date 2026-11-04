import { useEffect, useState } from 'react'

const MIN_DELAY_MS = 2500
const MAX_DELAY_MS = 6500
const BLINK_MS = 110
const DOUBLE_BLINK_CHANCE = 0.2

/** Clignement à intervalles aléatoires, parfois double, comme un regard vivant. */
export function useBlink(enabled: boolean): boolean {
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setClosed(false)
      return
    }
    let timer: ReturnType<typeof setTimeout>

    const blink = (then: () => void): void => {
      setClosed(true)
      timer = setTimeout(() => {
        setClosed(false)
        then()
      }, BLINK_MS)
    }

    const schedule = (): void => {
      const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
      timer = setTimeout(() => {
        blink(() => {
          if (Math.random() < DOUBLE_BLINK_CHANCE) {
            timer = setTimeout(() => blink(schedule), BLINK_MS)
          } else {
            schedule()
          }
        })
      }, delay)
    }

    schedule()
    return () => clearTimeout(timer)
  }, [enabled])

  return closed
}

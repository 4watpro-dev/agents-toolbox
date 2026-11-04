import { describe, expect, it } from 'vitest'
import { buildLoginItemPlist } from './loginItemPlist'

describe('buildLoginItemPlist', () => {
  it('lance Electron sur le projet à l\'ouverture de session', () => {
    const plist = buildLoginItemPlist('/app/Electron', '/Users/x/agent-toolbox')
    expect(plist).toContain('<string>/app/Electron</string>')
    expect(plist).toContain('<string>/Users/x/agent-toolbox</string>')
    expect(plist).toContain('<key>RunAtLoad</key>')
  })

  it('échappe un chemin contenant des caractères spéciaux', () => {
    expect(buildLoginItemPlist('/a & b/<c>', '/p')).toContain('<string>/a &amp; b/&lt;c&gt;</string>')
  })
})

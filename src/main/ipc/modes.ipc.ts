import { ipcMain } from 'electron'
import { IPC, type SuggestTopicsRequest, type VoiceCatalog } from '@shared/ipc-channels'
import { buildTopicPrompt, parseTopics, type TopicSuggestion } from '@shared/modes/fakta-unik'
import { getTextLlm } from '../platform/ai/clients'
import { getProductionQueue } from '../production'
import { piper } from '../modes/fakta-unik/runtime'

export function registerModesIpc(): void {
  ipcMain.handle(IPC.modeVoices, (): VoiceCatalog => ({
    piper: piper().voices().map((v) => ({ name: v.name, lang: v.lang }))
  }))

  ipcMain.handle(IPC.modeSuggestTopics, async (_e, req: Partial<SuggestTopicsRequest>): Promise<TopicSuggestion[]> => {
    if (req?.mode !== 'fakta-unik') throw new Error('Saran topik belum tersedia untuk mode ini.')
    const seed = typeof req.seed === 'string' ? req.seed : ''
    const language = typeof req.language === 'string' ? req.language : 'id'
    // Judul yang sudah pernah jadi ikut dikirim supaya saran tidak mengulang.
    const avoid = getProductionQueue().recentTitles('fakta-unik')
    return parseTopics(await getTextLlm()({ ...buildTopicPrompt({ seed, language, avoid }), temperature: 1 }))
  })
}

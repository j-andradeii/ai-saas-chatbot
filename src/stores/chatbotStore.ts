import { create } from 'zustand'

interface ChatbotStore {
  selectedChatbotId: string | null
  setSelectedChatbotId: (id: string | null) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useChatbotStore = create<ChatbotStore>((set) => ({
  selectedChatbotId: null,
  setSelectedChatbotId: (id) => set({ selectedChatbotId: id }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

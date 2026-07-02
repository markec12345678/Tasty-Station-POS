import { create } from 'zustand';
import axiosInstance from '@/axios/axiosInstace';

const useChatStore = create((set, get) => ({
    isOpen: false,
    messages: [{ role: 'assistant', content: 'Hi! I am your POS assistant. How can I help you today?' }],
    isLoading: false,

    toggleChat: () => set({ isOpen: !get().isOpen }),

    sendMessage: async (message, context) => {
        const { messages } = get();
        // Add user message immediately
        set({
            messages: [...messages, { role: 'user', content: message }],
            isLoading: true
        });

        try {
            // Popravek: prej hardcoded http://localhost:3000 — v produkciji chat ni deloval.
            // Sedaj uporabljamo centralni axiosInstance (z baseURL + credentials + timeout).
            const response = await axiosInstance.post('/chat/message', {
                message,
                context: context || window.location.pathname // Simple context: current URL
            });

            set({
                messages: [...get().messages, { role: 'assistant', content: response.data.reply }],
                isLoading: false
            });
        } catch (error) {
            console.error("Chat error:", error);
            set({
                messages: [...get().messages, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }],
                isLoading: false
            });
        }
    }
}));

export default useChatStore;

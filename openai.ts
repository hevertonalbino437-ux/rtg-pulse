import OpenAI from "openai";

// 1. Inicializa a OpenAI usando a chave do seu arquivo .env
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Necessário se estiver chamando direto do front-end
});

// 2. O ID do seu assistente (copiado das suas fotos anteriores)
const ASSISTANT_ID = "asst_jWxZHm2k5kg8GPisyXbLJl4e";

export const processarVistoriaRedemais = async (textoInformal: string) => {
  try {
    // Cria uma "conversa" (thread)
    const thread = await openai.beta.threads.create();

    // Envia a anotação da Jamile para a thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: textoInformal
    });

    // Manda o Assistente processar usando os 10 PDFs de exemplo
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const resposta = messages.data[0].content[0];
      
      // Retorna o texto técnico pronto para o laudo
      return resposta.type === 'text' ? resposta.text.value : null;
    }
    
    return "Erro no processamento.";
  } catch (error) {
    console.error("Erro na Redemais IA:", error);
    return "Falha ao conectar com o servidor.";
  }
};

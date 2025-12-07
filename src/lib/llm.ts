import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CallLLMParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
};

export async function callLLM({
  systemPrompt,
  userPrompt,
  model = 'gpt-4.1-mini',
}: CallLLMParams): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content;
  } catch (err) {
    console.error('Error calling LLM:', err);
    throw new Error('LLM call failed');
  }
}

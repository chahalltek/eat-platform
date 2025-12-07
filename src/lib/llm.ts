import OpenAI from 'openai';

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
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await new OpenAI({ apiKey }).chat.completions.create({
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

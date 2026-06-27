/**
 * PATH-WISE · JSON 提取工具
 * 从 LLM 原始输出中提取纯 JSON，处理 Markdown 代码块包裹、多余文字等情况
 */

/**
 * 从 LLM 原始输出中提取纯 JSON
 * 处理 Markdown 代码块包裹、多余文字等情况
 *
 * @param rawOutput - LLM 返回的原始文本
 * @returns 提取出的纯 JSON 字符串
 * @throws 如果无法提取有效 JSON
 */
export function extractJSON(rawOutput: string): string {
  const trimmed = rawOutput.trim();

  // 尝试 1：直接解析
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // 继续尝试
  }

  // 尝试 2：提取 ```json ... ``` 代码块
  const jsonBlockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      JSON.parse(jsonBlockMatch[1]);
      return jsonBlockMatch[1];
    } catch {
      // 继续尝试
    }
  }

  // 尝试 3：提取 ``` ... ``` 通用代码块
  const codeBlockMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      JSON.parse(codeBlockMatch[1]);
      return codeBlockMatch[1];
    } catch {
      // 继续尝试
    }
  }

  // 尝试 4：提取第一个 { ... } 对象（非贪婪匹配不行，用贪婪）
  const jsonObjectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    try {
      JSON.parse(jsonObjectMatch[0]);
      return jsonObjectMatch[0];
    } catch {
      // 继续尝试
    }
  }

  // 兜底：抛出错误
  throw new Error('Failed to extract valid JSON from LLM output');
}

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

  // 尝试 4：使用括号计数（bracket counting）精确提取第一个完整 JSON 对象
  // 避免贪婪正则 \{[\s\S]*\} 跨多个 JSON 对象匹配的问题
  const firstBrace = trimmed.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = firstBrace; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.slice(firstBrace, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            break;
          }
        }
      }
    }
  }

  // 兜底：抛出错误
  throw new Error('Failed to extract valid JSON from LLM output');
}

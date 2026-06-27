/**
 * SSE 流工具单元测试
 * 覆盖 createSSEStream / send / end
 */
import { describe, it, expect, vi } from 'vitest';
import { createSSEStream } from '../utils/sseStream.js';

/** 构造最小化 mock FastifyReply */
function mockReply() {
  const raw = {
    written: false,
    ended: false,
    headStatus: 0,
    headHeaders: {} as Record<string, string>,
    chunks: [] as string[],
    writeHead(status: number, headers: Record<string, string>) {
      this.headStatus = status;
      this.headHeaders = headers;
    },
    write(chunk: string) {
      this.chunks.push(chunk);
    },
    end() {
      this.ended = true;
    },
  };

  return {
    raw,
    status() {
      return this;
    },
    send() {
      return this;
    },
  } as any;
}

describe('createSSEStream', () => {
  describe('初始化', () => {
    it('应写入 HTTP 200 和正确的 SSE 响应头', () => {
      const reply = mockReply();
      createSSEStream(reply);

      expect(reply.raw.headStatus).toBe(200);
      expect(reply.raw.headHeaders['Content-Type']).toBe('text/event-stream');
      expect(reply.raw.headHeaders['Cache-Control']).toBe('no-cache');
      expect(reply.raw.headHeaders['Connection']).toBe('keep-alive');
      expect(reply.raw.headHeaders['X-Accel-Buffering']).toBe('no');
    });

    it('应返回 send 和 end 方法', () => {
      const reply = mockReply();
      const stream = createSSEStream(reply);

      expect(stream).toHaveProperty('send');
      expect(stream).toHaveProperty('end');
      expect(typeof stream.send).toBe('function');
      expect(typeof stream.end).toBe('function');
    });
  });

  describe('send()', () => {
    it('应写入学正确格式的 SSE 事件帧', () => {
      const reply = mockReply();
      const stream = createSSEStream(reply);

      stream.send('connected', { taskId: 'abc-123' });

      const written = reply.raw.chunks.join('');
      expect(written).toContain('event: connected');
      expect(written).toContain('data: ');
      expect(written).toContain('"taskId":"abc-123"');
      expect(written).toContain('\n\n');
    });

    it('应正确序列化各种数据类型', () => {
      const reply = mockReply();
      const stream = createSSEStream(reply);

      stream.send('progress', {
        step: 1,
        percent: 50,
        message: '正在生成...',
        children: [1, 2, 3],
      });

      const written = reply.raw.chunks.join('');
      const dataPart = written.replace(/^event: progress\ndata: /, '').replace(/\n\n$/, '');
      const parsed = JSON.parse(dataPart);

      expect(parsed.step).toBe(1);
      expect(parsed.percent).toBe(50);
      expect(parsed.message).toBe('正在生成...');
      expect(parsed.children).toEqual([1, 2, 3]);
    });

    it('多次 send 应追加而非覆盖', () => {
      const reply = mockReply();
      const stream = createSSEStream(reply);

      stream.send('progress', { step: 1 });
      stream.send('day_ready', { dayIndex: 1 });
      stream.send('done', { tripId: 't1' });

      expect(reply.raw.chunks.length).toBe(3);
    });

    it('null 和空数据也能序列化', () => {
      const reply = mockReply();
      const stream = createSSEStream(reply);

      expect(() => stream.send('connected', null)).not.toThrow();
      expect(() => stream.send('connected', '')).not.toThrow();
      expect(() => stream.send('connected', undefined)).not.toThrow();
    });

    it('event 名称为空字符串时也能工作', () => {
      const reply = mockReply();
      const stream = createSSEStream(reply);

      expect(() => stream.send('', { data: true })).not.toThrow();

      const written = reply.raw.chunks.join('');
      expect(written).toContain('event: ');
    });
  });

  describe('end()', () => {
    it('应调用底层 reply.raw.end()', () => {
      const reply = mockReply();
      const stream = createSSEStream(reply);

      expect(reply.raw.ended).toBe(false);
      stream.end();
      expect(reply.raw.ended).toBe(true);
    });

    it('多次 end 不会抛异常', () => {
      const reply = mockReply();
      const stream = createSSEStream(reply);

      expect(() => {
        stream.end();
        stream.end();
        stream.end();
      }).not.toThrow();
    });
  });
});

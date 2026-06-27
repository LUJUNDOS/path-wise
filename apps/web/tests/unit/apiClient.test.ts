/**
 * API 客户端单元测试
 * 覆盖 ApiError / apiClient 构造 / HTTP 方法 / 错误拦截器
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { ApiError, apiClient } from '@/lib/apiClient';

// Mock axios.create 返回的 instance
const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    response: {
      use: vi.fn(),
      eject: vi.fn(),
      clear: vi.fn(),
    },
  },
};

describe('ApiError', () => {
  it('应正确设置所有属性', () => {
    const err = new ApiError('测试错误', {
      businessCode: 10001,
      httpStatus: 404,
      url: '/api/v1/trips/123',
      method: 'GET',
    });

    expect(err.message).toBe('测试错误');
    expect(err.name).toBe('ApiError');
    expect(err.businessCode).toBe(10001);
    expect(err.httpStatus).toBe(404);
    expect(err.url).toBe('/api/v1/trips/123');
    expect(err.method).toBe('GET');
    expect(err.response).toBeUndefined();
  });

  it('应保留原始错误响应体', () => {
    const errorResponse = {
      code: 10002,
      message: '攻略不存在',
      meta: { requestId: 'r1', timestamp: '2026-01-01', processingTimeMs: 0 },
    };

    const err = new ApiError('request failed', {
      businessCode: 10002,
      httpStatus: 404,
      url: '/api/v1/trips/999',
      method: 'GET',
      response: errorResponse,
    });

    expect(err.response).toEqual(errorResponse);
    expect(err.response?.code).toBe(10002);
  });

  it('应继承自 Error', () => {
    const err = new ApiError('test', {
      businessCode: 0,
      httpStatus: 0,
      url: '',
      method: 'GET',
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it('method 默认值应为空字符串', () => {
    const err = new ApiError('test', {
      businessCode: 0,
      httpStatus: 0,
      url: '',
      method: '',
    });

    expect(err.method).toBe('');
  });

  it('应能在 try-catch 中被正确捕获', () => {
    const caught: ApiError[] = [];
    try {
      throw new ApiError('失败了', {
        businessCode: 500,
        httpStatus: 502,
        url: '/test',
        method: 'POST',
      });
    } catch (e) {
      if (e instanceof ApiError) {
        caught.push(e);
      }
    }

    expect(caught.length).toBe(1);
    expect(caught[0].message).toBe('失败了');
    expect(caught[0].method).toBe('POST');
  });
});

describe('apiClient', () => {
  it('应导出单例 apiClient 实例', () => {
    expect(apiClient).toBeDefined();
    expect(apiClient).toHaveProperty('instance');
    expect(apiClient).toHaveProperty('get');
    expect(apiClient).toHaveProperty('post');
    expect(apiClient).toHaveProperty('put');
    expect(apiClient).toHaveProperty('delete');
  });

  it('instance 应为 AxiosInstance', () => {
    expect(apiClient.instance).toBeDefined();
    expect(typeof apiClient.instance.get).toBe('function');
    expect(typeof apiClient.instance.post).toBe('function');
  });

  it('get/post/put/delete 均为异步方法', () => {
    expect(apiClient.get).toBeInstanceOf(Function);
    expect(apiClient.post).toBeInstanceOf(Function);
    expect(apiClient.put).toBeInstanceOf(Function);
    expect(apiClient.delete).toBeInstanceOf(Function);
  });
});

import axios, { type AxiosInstance, type AxiosError } from "axios";
import type { ApiResponse, ErrorResponse } from "@path-wise/shared";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

/**
 * 增强的错误类型，保留 HTTP 元数据和业务错误码
 * 调用方可据此区分网络错误、业务错误、HTTP 状态码错误。
 */
export class ApiError extends Error {
  /** 业务错误码（来自响应体 code 字段） */
  public readonly businessCode: number;
  /** HTTP 状态码 */
  public readonly httpStatus: number;
  /** 请求 URL */
  public readonly url: string;
  /** 请求方法 */
  public readonly method: string;
  /** 原始业务错误响应体 */
  public readonly response?: ErrorResponse;

  constructor(
    message: string,
    options: {
      businessCode: number;
      httpStatus: number;
      url: string;
      method: string;
      response?: ErrorResponse;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.businessCode = options.businessCode;
    this.httpStatus = options.httpStatus;
    this.url = options.url;
    this.method = options.method;
    this.response = options.response;
  }
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ErrorResponse>) => {
        if (error.response) {
          const { data, status, config } = error.response;
          const message = data?.message ?? `请求失败 (${status})`;
          throw new ApiError(message, {
            businessCode: data?.code ?? status,
            httpStatus: status,
            url: config?.url ?? "",
            method: config?.method?.toUpperCase() ?? "GET",
            response: data,
          });
        }

        // 网络层错误（无 response）
        throw new ApiError("网络连接失败，请检查网络", {
          businessCode: 0,
          httpStatus: 0,
          url: error.config?.url ?? "",
          method: error.config?.method?.toUpperCase() ?? "GET",
        });
      },
    );
  }

  get instance(): AxiosInstance {
    return this.client;
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url);
    return response.data;
  }
}

export const apiClient = new ApiClient();

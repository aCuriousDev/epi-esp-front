import axios, {
  AxiosRequestConfig,
} from "axios";
// import { useToast } from "../../hook/useToast";
import { PaginatedResponseModel } from "./model/PaginatedResponseModel";

export abstract class ApiCall {

    private static config = {
        apiUrl : ""
    }

  private static setAuthHeader() {
    axios.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${window.localStorage.getItem("token")}`;
  }

  private static getFullUrl(url: string): string {
    if (url.startsWith("http")) {
      return url;
    }
    return `${this.config.apiUrl}${url.startsWith("/") ? url : `/${url}`}`;
  }

  public static async Get<T>(url: string): Promise<T> {
    try {
      this.setAuthHeader();
      const fullUrl = this.getFullUrl(url);
      const call = await axios.get(fullUrl);
      const data: T = call.data.data;
      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        return Promise.reject(error.response.data.message);
      }
      if (axios.isAxiosError(error)) {
        return Promise.reject<T>("AxiosError :" + error);
      } else {
        return Promise.reject<T>("Error :" + error);
      }
    }
  }

  public static async RawGet(
    url: string,
    header: AxiosRequestConfig
  ): Promise<any> {
    try {
      const fullUrl = this.getFullUrl(url);
      const call = await axios.get(fullUrl, header);
      return call.data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        return Promise.reject(error.response.data.message);
      }
      if (axios.isAxiosError(error)) {
        return Promise.reject("AxiosError :" + error);
      } else {
        return Promise.reject("Error :" + error);
      }
    }
  }

  public static async Post<T>(url: string, body: any): Promise<T> {
    try {
      this.setAuthHeader();
      const fullUrl = this.getFullUrl(url);
      const call = await axios.post(fullUrl, body);
      if (call.status != 200) {
        return Promise.reject<T>("CallError :" + call.statusText);
      }
      const data: T = call.data.data;
      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        return Promise.reject<T>(error.response.data.message);
      }
      if (axios.isAxiosError(error)) {
        return Promise.reject<T>("AxiosError :" + error);
      } else {
        return Promise.reject<T>("Error :" + error);
      }
    }
  }

  public static async RawPost(
    url: string,
    body: any,
    header?: AxiosRequestConfig | undefined
  ): Promise<any> {
    try {
      const fullUrl = this.getFullUrl(url);
      const call = await axios.post(fullUrl, body, header);
      if (call.status != 200) {
        return Promise.reject("CallError :" + call.statusText);
      }
      const data = call.data;
      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        return Promise.reject(error.response.data.message);
      }
      if (axios.isAxiosError(error)) {
        return Promise.reject("AxiosError :" + error);
      } else {
        return Promise.reject("Error :" + error);
      }
    }
  }

  public static async GetPaginated<T>(
    url: string,
    body: any
  ): Promise<PaginatedResponseModel<T>> {
    try {
      this.setAuthHeader();
      const fullUrl = this.getFullUrl(url);
      const call = await axios.post(fullUrl, body);
      if (call.status != 200) {
        return Promise.reject("CallError :" + call.statusText);
      }
      const data = call.data;

      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        return Promise.reject(error.response.data.message);
      }
      if (axios.isAxiosError(error)) {
        return Promise.reject("AxiosError :" + error);
      } else {
        return Promise.reject("Error :" + error);
      }
    }
  }

   public static async Patch<T>(url: string, body: any): Promise<T> {
    try {
      this.setAuthHeader();
      const fullUrl = this.getFullUrl(url);
      const call = await axios.patch(fullUrl, body);
      if (call.status !== 200) {
        return Promise.reject<T>("CallError :" + call.statusText);
      }
      const data: T = call.data.data;
      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        return Promise.reject(error.response.data.message);
      }
      if (axios.isAxiosError(error)) {
        return Promise.reject<T>("AxiosError :" + error);
      } else {
        return Promise.reject<T>("Error :" + error);
      }
    }
  }

  public static async Update<T>(url: string, body: any): Promise<T> {
    try {
      this.setAuthHeader();
      const fullUrl = this.getFullUrl(url);
      const call = await axios.put(fullUrl, body);
      if (call.status !== 200) {
        return Promise.reject<T>("CallError :" + call.statusText);
      }
      const data: T = call.data.data;
      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        return Promise.reject(error.response.data.message);
      }
      if (axios.isAxiosError(error)) {
        return Promise.reject<T>("AxiosError :" + error);
      } else {
        return Promise.reject<T>("Error :" + error);
      }
    }
  }

  public static async Delete<T>(url: string): Promise<T> {
    try {
      this.setAuthHeader();
      const fullUrl = this.getFullUrl(url);
      const call = await axios.delete(fullUrl);
      if (call.data.success !== true) {
        return Promise.reject<T>("CallError :" + call.statusText);
      }
      const data: T = call.data.data;
      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.data &&
        typeof error.response.data.message === "string"
      ) {
        return Promise.reject(error.response.data.message);
      }
      if (axios.isAxiosError(error)) {
        return Promise.reject<T>("AxiosError :" + error);
      } else {
        return Promise.reject<T>("Error :" + error);
      }
    }
  }
}

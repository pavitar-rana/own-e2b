import axios from "axios";

export const createFirecrackerClient = (socketPath: string) => {
    const instance = axios.create({
        socketPath,
        baseURL: "http://localhost",
    });

    return {
        get: <T>(path: string) => instance.get<T>(path).then((r) => r.data),
        put: <T>(path: string, data: any) => instance.put<T>(path, data).then((r) => r.data),
    };
};

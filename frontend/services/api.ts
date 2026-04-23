import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ Palitan ng actual IP ng computer mo (hindi localhost para sa mobile!)
// Para malaman: ipconfig (Windows) o ifconfig (Mac/Linux)
const BASE_URL = 'http://192.168.1.105:5261/api';

const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Automatically attach JWT token to every request
api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
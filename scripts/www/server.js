#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 9000;

// 添加CORS中间件
app.use((req, res, next) => {
  // 使用请求头中的origin字段作为允许的来源，若无则默认为*
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// 添加JSON解析中间件
app.use(express.json());

// 添加API代理路由（用于转发到云同步服务）
app.post('/api/sync', async (req, res) => {
  try {
    const { targetUrl, secretKey, ...payload } = req.body;
    
    if (!targetUrl) {
      return res.status(400).json({ error: '目标URL不能为空' });
    }
    
    // 规范化目标URL
    let url = targetUrl.trim().replace(/\/+$/, '');
    if (!url.endsWith('/sync')) {
      url += '/sync';
    }
    
    // 构建函数计算格式的请求体
    const syncKey = process.env.SYNC_SECRET_KEY || 'default_sync_key_for_multi_device';
    if (!process.env.SYNC_SECRET_KEY) {
        console.warn('⚠️ 警告：使用默认同步密钥，建议在腾讯云控制台配置SYNC_SECRET_KEY环境变量');
    }
    const fcRequest = {
      path: '/sync',
      httpMethod: 'POST',
      headers: {
        'host': new URL(url).host,
        'user-agent': 'MingHui-System/1.0',
        'x-mh-sync-key': syncKey,
        'content-type': 'application/json'
      },
      queryStringParameters: {},
      pathParameters: {},
      body: JSON.stringify(payload),
      isBase64Encoded: false
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Date': new Date().toUTCString()
      },
      body: JSON.stringify(fcRequest)
    });
    
    const data = await response.json();
    
    // 检查云端返回的错误，提供更友好的错误信息
    if (data.Code && data.Message) {
if (data.Code === 'InvalidArgument' && data.Message.includes('authorization')) {
        console.error(`⛔ 认证失败: 客户端密钥 ${req.headers['x-mh-sync-key']?.slice(0,3)}*** 不匹配`);
        return res.status(401).json({ 
          error: '认证失败', 
          message: '请检查同步配置中的密钥是否正确设置',
          detail: data.Message,
          solution: '请在腾讯云控制台设置SYNC_SECRET_KEY环境变量并重启服务'
        });
      }
    }
    
    res.json(data);
  } catch (error) {
    console.error('代理请求失败:', error);
    res.status(500).json({ 
      error: '同步失败', 
      message: `阿里云服务错误：${error.message || '未知错误'}`,
      detail: '请检查阿里云函数计算和OSS存储配置'
    });
  }
});

// 添加GET代理路由（用于从云端拉取数据）
app.get('/api/sync', async (req, res) => {
  try {
    const { targetUrl, secretKey } = req.query;
    
    if (!targetUrl) {
      return res.status(400).json({ error: '目标URL不能为空' });
    }
    
    // 规范化目标URL
    let url = targetUrl.trim().replace(/\/+$/, '');
    if (!url.endsWith('/sync')) {
      url += '/sync';
    }
    
    // 构建函数计算格式的请求体
    const syncKey = process.env.SYNC_SECRET_KEY;
    if (!syncKey) {
        console.error('❌ 安全错误：必须配置SYNC_SECRET_KEY环境变量');
        return res.status(500).json({
            error: '服务器配置错误',
            message: '未配置SYNC_SECRET_KEY环境变量',
            solution: '请在腾讯云控制台设置SYNC_SECRET_KEY环境变量并重启服务'
        });
    }
    const fcRequest = {
      path: '/sync',
      httpMethod: 'GET',
      headers: {
        'host': new URL(url).host,
        'user-agent': 'MingHui-System/1.0',
        'x-mh-sync-key': syncKey
      },
      queryStringParameters: {},
      pathParameters: {},
      body: '',
      isBase64Encoded: false
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Date': new Date().toUTCString()
      },
      body: JSON.stringify(fcRequest)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: '拉取失败' });
  }
});

// 静态文件服务 - 服务于打包后的dist目录
app.use(express.static(path.join(__dirname, 'dist')));

// 处理SPA路由 - 所有路由返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
console.log(`明惠地产营销系统服务已启动，端口: ${port}`);
console.log(`访问地址: http://localhost:${port}`);
console.log(`🔐 同步密钥配置: ${process.env.SYNC_SECRET_KEY ? '✅ 已设置' : '⚠️ 使用默认密钥 - 多设备可正常访问'}`);
if (!process.env.SYNC_SECRET_KEY) {
    console.log('💡 提示：所有设备均可使用默认密钥进行同步，如需更安全可自定义环境变量');
}
});
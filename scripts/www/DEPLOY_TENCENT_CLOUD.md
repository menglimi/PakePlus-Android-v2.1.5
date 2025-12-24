# 腾讯云部署配置指南

## 解决权限问题

腾讯云部署时遇到的 `vite: Permission denied` 问题已通过以下方式解决：

### 1. 构建脚本配置
在 `package.json` 中添加了兼容腾讯云的构建命令：
```json
"build:cloud": "node node_modules/vite/bin/vite.js build --mode production"
```

### 2. 腾讯云部署配置

#### 方法一：使用自定义构建命令
在腾讯云的控制台中，修改构建命令为：
```bash
npm run build:cloud
```

#### 方法二：环境变量配置
如果腾讯云支持环境变量配置，可以设置：
```bash
NODE_ENV=production
```

### 3. 手动验证构建
在部署前，您可以在本地验证构建是否正常：
```bash
# 清理并重新安装依赖
npm ci

# 使用腾讯云兼容命令构建
npm run build:cloud

# 验证构建产物
ls -la dist/
```

### 4. 其他注意事项

#### Node版本兼容性
确保腾讯云环境使用 Node.js 20+ 版本：
```json
// 可以在 package.json 中添加引擎要求
"engines": {
  "node": ">=20.0.0"
}
```

#### 环境变量配置
确保腾讯云环境中配置了必要的环境变量：
- 数据库连接信息
- API密钥
- 其他敏感配置

#### 静态文件服务
如果使用腾讯云的静态网站托管，确保正确配置：
- 根目录指向 `dist` 文件夹
- 单页应用路由配置

### 5. 故障排除

如果仍然遇到权限问题，尝试：
```bash
# 清理 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install

# 给脚本添加执行权限（如果腾讯云支持）
chmod +x node_modules/.bin/vite
```

### 6. 部署验证
部署成功后，检查：
- ✅ 页面正常加载
- ✅ 所有功能正常工作
- ✅ 静态资源正确加载
- ✅ 路由导航正常

如果您在使用这些步骤时仍然遇到问题，请提供具体的错误信息以便进一步诊断。
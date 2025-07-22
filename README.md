# 🚀 Crypto Assistant - Professional Trading Signals

A full-stack cryptocurrency trading assistant with real-time signals, technical analysis, and professional UI.

## 🌐 **Live Demo**

- **Frontend**: [https://crypto-assistant-tan.vercel.app](https://crypto-assistant-tan.vercel.app)
- **Backend**: Ready for deployment on Render

## ✨ **Features**

### 📊 **Technical Analysis**
- RSI, MACD, Bollinger Bands
- EMA 20/50 crossovers
- Stochastic oscillator
- Chart pattern detection
- Candlestick pattern analysis

### 📈 **Trading Signals**
- BUY/SELL/HOLD recommendations
- Confidence scoring (0-100%)
- Entry/exit points
- Stop loss and take profit levels
- Multi-timeframe analysis (1m, 15m, 30m, 4h)

### 🎨 **Professional UI**
- Real-time price updates
- Responsive design
- Dark/light mode support
- Symbol selection
- Market overview

## 🚀 **Quick Start**

### **Deploy Backend (5 minutes)**
1. Go to [render.com](https://render.com)
2. Create new Web Service from this repository
3. Set root directory to `backend`
4. Add environment variables (see deployment guide)

### **Update Frontend**
1. Get your Render backend URL
2. Update `NEXT_PUBLIC_API_URL` in Vercel
3. Redeploy frontend

**Full deployment guide**: [DEPLOYMENT_COMPLETE_GUIDE.md](./DEPLOYMENT_COMPLETE_GUIDE.md)

## 🛠 **Tech Stack**

### **Frontend**
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Socket.io for real-time updates
- Recharts for data visualization

### **Backend**
- Node.js with Express
- TypeScript
- Socket.io for WebSocket
- CCXT for exchange integration
- Technical indicators library

## 📁 **Project Structure**

```
├── frontend/          # Next.js frontend (Vercel)
├── backend/           # Node.js backend (Render)
└── docs/             # Deployment guides
```

## 🔧 **Development**

### **Frontend**
```bash
cd frontend
npm install
npm run dev
```

### **Backend**
```bash
cd backend
npm install
npm run dev
```

## 📚 **Documentation**

- [Frontend Deployment Guide](./frontend/VERCEL_DEPLOYMENT_FIXED.md)
- [Backend Deployment Guide](./backend/RENDER_DEPLOYMENT_GUIDE.md)
- [Complete Deployment Guide](./DEPLOYMENT_COMPLETE_GUIDE.md)

## 🎯 **Ready for Production**

Both frontend and backend are production-ready with:
- ✅ CSS issues fixed
- ✅ Build errors resolved
- ✅ Environment configuration
- ✅ CORS properly configured
- ✅ Performance optimizations

**Start trading with professional signals today!** 📈
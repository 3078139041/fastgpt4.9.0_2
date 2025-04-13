import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './modules/counterStore';

// 创建根store组合子模块
// store 就是一个游戏机
const store = configureStore({
  reducer: {
    // counterReducer​​ 是 ​​"游戏卡带"​​（包含游戏规则）
    counter: counterReducer
  }
});

export default store;

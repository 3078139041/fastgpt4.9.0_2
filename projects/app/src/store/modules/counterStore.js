import { createSlice } from '@reduxjs/toolkit';

// 1. createSlice 是一个工具，用来创建initialState、reducers 这些属性
// 设计一款游戏卡带
const counterStore = createSlice({
  // 比如 increment 这个方法的完整 action 类型会是 "counter/increment"（name + reducer名）。
  // Redux 用这个类型来区分不同的 action（比如“计数器+1” vs “购物车添加商品”）。
  // 相当于就是开一个 命名空间
  name: 'counter',
  // 初始状态数量
  initialState: {
    count: 100
  },
  // 修改数据的同步方法
  reducers: {
    increment(state) {
      state.count++;
    },
    decrement(state) {
      state.count--;
    },
    // 传递参数
    addToNum(state, action) {
      // 传的值就是 payload
      state.count += action.payload;
    }
  }
});

// 解构出创建 action 对象的函数 （actionCreater）
// ​​从计数器工具包里拿出"加"和"减"两个控制按钮，准备给其他地方使用
const { increment, decrement, addToNum } = counterStore.actions;

// 获取 reducer 函数
// 当收到 increment 或 decrement 命令时，实际改变数字​​！

/* 你按了手柄的 +1 按钮（increment）​​ → 这只是发送了一个命令。
 ​​游戏机（reducer）收到命令后​​，才会真正把数字 +1 */

//  制作好的实体卡带
const counterReducer = counterStore.reducer;

// 导出创建action对象的函数和reducer函数
export { increment, decrement, addToNum };
export default counterReducer;

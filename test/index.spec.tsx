import React, { ReactElement } from 'react'
import {cleanup, fireEvent, render} from '@testing-library/react'
import { select, slice } from "../src";
import { configureStore, PayloadAction } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

type TestSlice = {
  word: string,
  num: number,
  car: {
    wheelsNum: number
  }
}

const mySlice = slice('test', {} as TestSlice, {
  setWord(state, action: PayloadAction<string>) {
    state.word = action.payload;
  },
  setNum(state, nums: PayloadAction<[number, number]>) {
    state.num = nums.payload[0];
    state.car = {
      ...state.car,
      wheelsNum: nums.payload[1]
    }
  }
})

const allNum = select([mySlice.num, mySlice.car.wheelsNum], (num, wheels) => (num || 0) + (wheels || 0))

export const store = configureStore({
  reducer: { test: mySlice.$$reducer },
})

const TestComponent = () => {
  const word = mySlice.word.use();

  const setWord = mySlice.setWord.use(); 

  return (
    <div>
      <button onClick={() => {
        setWord('test');
      }}></button>
      <span>{word}</span>
    </div>
  )
}


const TestComponent2 = () => {
  const num = mySlice.use(state => state.num);
  const wheels = mySlice.car.use(state => state && state.wheelsNum);

  const setNum = mySlice.setNum.use();
  
  const total = allNum.use();

  return (
    <div>
      <button onClick={() => {
        setNum([2,5])
      }}></button>
      <h1>{total}</h1>
      <h2>{wheels}</h2>
      <h3>{num}</h3>
    </div>
  )
}

afterEach(cleanup)

describe('index', () => {
  describe('slice', () => {
    it('should render the component', () => {

      const { container } = render(
        <Provider store={store} >
          <TestComponent />
        </Provider>
      )

      expect(container.querySelector('span')).toBeEmptyDOMElement();

      const button = container.querySelector('button');
      if (button) fireEvent.click(button);

      expect(container.querySelector('span')).toHaveTextContent('test');
    });

    it('should render the component 2', () => {

      const { container } = render(
        <Provider store={store} >
          <TestComponent2 />
        </Provider>
      )

      expect(container.querySelector('h1')).toHaveTextContent('0');

      const button = container.querySelector('button');
      if (button) fireEvent.click(button);

      expect(container.querySelector('h1')).toHaveTextContent('7');
      expect(container.querySelector('h2')).toHaveTextContent('5');
      expect(container.querySelector('h3')).toHaveTextContent('2');
    });
  });
});

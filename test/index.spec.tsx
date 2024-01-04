import React, { ReactElement } from 'react'
import {cleanup, fireEvent, render} from '@testing-library/react'
import { select, model } from "../src";
import { configureStore, PayloadAction } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

type TestSlice = {
  word?: string,
  num: number,
  car: {
    wheelsNum?: number
  },
  samples: string[]
}

const state: TestSlice = { num: 0, car: {}, samples:['apple'] };

const testSlice = model({
  name: 'test', 
  initialState: state, 
  reducers: {
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
  }
})

const allNum = select([testSlice.num, testSlice.car.wheelsNum], (num, wheels) => (num || 0) + (wheels || 0))

const state2 = {
  single: testSlice,
  list: [testSlice]
}

const testSlice2 = model({
  name: 'test2', 
  initialState: state2, 
  reducers: {
    add(state, action) {
      state.list.push({ ...action.payload })
    },
    setSingle(state, action) {
      state.single = action.payload
    }
  }
})

export const store = configureStore({
  reducer: { 
    test: testSlice.$$reducer, 
    test2: testSlice2.$$reducer 
  },
})

const TestComponent = () => {
  const word = testSlice.word.useMe();
  const setWord = testSlice.setWord.useMe()

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
  const num = testSlice.useMe(state => state.num);
  const wheels = testSlice.car.useMe(state => state && state.wheelsNum);

  const setNum = testSlice.setNum.useMe();
  
  const total = allNum.useMe();

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

const TestComponent3 = () => {
  const { list, single } = testSlice2.useMe();
  const add = testSlice2.add.useMe();
  const setSingle = testSlice2.setSingle.useMe();
  
  return (
    <div>
      <button id="add" onClick={() => {
        add({})
        setSingle({ word: 'single '} as TestSlice)
      } } />
      <span id="len">{list.length}</span>
      {list.map((test, i) => (
        <div key={i}>
          <button id={`b${i}`} onClick={() => test.setWord(`Test${i}`)} />    
          <span id={`s${i}`}>{test.word}</span>
        </div>
      ))}
      <span id="single">{single && single.word}</span>
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

    it('should render the component 3', () => {

      const { container } = render(
        <Provider store={store} >
          <TestComponent3 />
        </Provider>
      )

      expect(container.querySelector('span#len')).toHaveTextContent('0');
      expect(container.querySelector('span#single')).toBeEmptyDOMElement()

      const button = container.querySelector('button#add');
      if (button) fireEvent.click(button);

      expect(container.querySelector('span#len')).toHaveTextContent('1');
      expect(container.querySelector('span#s0')).toBeEmptyDOMElement()
      expect(container.querySelector('span#single')).toHaveTextContent('single');

      const b1 = container.querySelector('button#b0');
      if (b1) fireEvent.click(b1);

      expect(container.querySelector('span#s0')).toHaveTextContent('Test0')

    });

    it('should throw and slice instance error', () => {
      let err: Error = new Error('');
      try {
        model({ 
          name: 'test4', 
          initialState: testSlice, 
          reducers: {}
        })
      } catch (e) {
        err = e as Error;
      }

      expect((err as Error).message).toBe('The whole state cannot be a slice instance');
    });

    it('should throw and duplicate error', () => {
      let err: Error = new Error('');
      try {
        model({
          name: 'test', 
          initialState: {}, 
          reducers: {}
        })
      } catch (e) {
        err = e as Error;
      }
      expect((err as Error).message).toBe('Duplicate slice name: test');
    });
  });
});

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { select, model, arg, combineModels, as, asModel, asModelList, StateType } from '../src';
import { configureStore, PayloadAction } from '@reduxjs/toolkit';
import { Provider, useSelector } from 'react-redux';

const state = {
  word: as<string>(),
  num: as<number>(0),
  car: {
    wheelsNum: as<number>(),
  },
  samples: as<string[]>(['apple']),
};

type TestState = StateType<typeof state>;

const testSlice = model(
  'test',
  state,
  {
    setWord(state, { payload }: PayloadAction<string>) {
      state.word = payload;
    },
    setNum(state, { payload }: PayloadAction<[number, number]>) {
      state.num = payload[0];
      state.car = {
        ...state.car,
        wheelsNum: payload[1],
      };
    },
  },
  {
    getNum: (state, plus: number) => {
      return state.num + plus;
    },
  }
);

let wordCalledCount = 0;
let numCalledCount = 0;

const concatWord = select([testSlice.word, testSlice.num], [arg<string>(1), arg<string[]>(2)], (word, num) => {
  wordCalledCount++;
  return `${word}${num}`;
});

const carData = select([testSlice.car], (car) => car.wheelsNum);

const allNum = select(
  [testSlice.num, carData],
  [(_state, arg: number) => arg, (_s, _a, arg: string) => arg],
  (num, wheels, arg, arg2) => {
    numCalledCount++;
    return (num ?? 0) + (wheels ?? 0) + (arg ?? 0) + parseInt(arg2);
  }
);

const state2 = {
  single: asModel(testSlice),
  list: asModelList(testSlice, []),
};

type TestState2 = StateType<typeof state2>;

const testSlice2 = model('test2', state2, {
  add(state, { payload }: PayloadAction<TestState>) {
    const record = payload;
    state.list.push({ ...record });
  },
  setSingle(state, { payload }: PayloadAction<TestState>) {
    state.single = payload;
  },
});

const fetchCount = (amount = 1) => {
  return new Promise<{ data: number }>((resolve) => setTimeout(() => resolve({ data: amount }), 500));
};

const counterState = {
  value: as<number>(0),
  status: as<string>('idle'),
  counterTest: asModel(testSlice2),
  counterTest2: asModelList(testSlice2, []),
};

type Counter = StateType<typeof counterState>;

const counterSlice = model('counter', counterState, ({ reducer, asyncThunk }) => ({
  increment: reducer((state) => {
    state.value += 1;
  }),
  decrement: reducer((state) => {
    state.value -= 1;
  }),
  incrementByAmount: reducer((state, action: PayloadAction<number>) => {
    state.value += action.payload;
  }),
  incrementAsync: asyncThunk(
    async (amount: number) => {
      const response = await fetchCount(amount);
      return response.data;
    },
    {
      pending: (state) => {
        state.status = 'loading';
      },
      fulfilled: (state, action) => {
        state.status = 'idle';
        state.value += action.payload;
      },
      rejected: (state) => {
        state.status = 'failed';
      },
    }
  ),
  addTest: reducer<TestState2>((state, { payload }) => {
    state.counterTest2?.push(payload);
  }),
}));

const countersState = {
  main: asModel(counterSlice, { value: 0, status: 'idle', counterTest: {} } as Counter),
  list: asModelList(counterSlice, []),
};

const counters = model('counters', countersState, {
  add(state, { payload }: PayloadAction<Counter>) {
    const record = payload;
    state.list.push({ ...record });
  },
});

export const store = configureStore({
  reducer: {
    ...combineModels(testSlice, testSlice2, counterSlice, counters),
  },
});

const TestComponent = () => {
  const word = useSelector(testSlice.word.$$selector);
  const wheels = testSlice.car.useWheelsNum();
  const setWord = testSlice.useSetWord();

  const sum = testSlice.useGetNum(wheels ?? 0);

  const setNum = testSlice.useSetNum();

  return (
    <div>
      <button
        onClick={() => {
          setWord('test');
          setNum([2, 1]);
        }}
      ></button>
      <span>{word}</span>
      <span id="sum">{sum}</span>
    </div>
  );
};

const TestComponent2 = () => {
  const word = testSlice.useWord();
  const num = testSlice.useNum();
  const wheels = testSlice.car.wheelsNum.useAll();

  const setWord = testSlice.useSetWord();
  const setNum = testSlice.setNum.useAction();

  const total = allNum.useSelect(1, '2');
  const selectWord = concatWord.useSelect();

  return (
    <div>
      <button
        id="num"
        onClick={() => {
          setNum([2, 5]);
        }}
      ></button>
      <button
        id="word"
        onClick={() => {
          setWord('sample');
        }}
      ></button>
      <h1>{total}</h1>
      <h2>{wheels}</h2>
      <h3>{num}</h3>
      <h3>{word}</h3>
      <h4>{selectWord}</h4>
      <h5>{numCalledCount}</h5>
      <h6>{wordCalledCount}</h6>
    </div>
  );
};

const TestComponent3 = () => {
  const { single } = testSlice2.useAll();

  const list = testSlice2.useList();

  const add = testSlice2.useAdd();
  const setSingle = testSlice2.useSetSingle();

  return (
    <div>
      <button
        id="add"
        onClick={() => {
          add({} as TestState);
          add({} as TestState);
          setSingle({ word: 'single ' } as TestState);
        }}
      />
      <span id="len">{list.length}</span>
      {list.map((test, i) => (
        <div key={i}>
          <button
            id={`b${i}`}
            onClick={() => {
              test.setWord(`Test${i}`);
              single?.setWord(`single${i}`);
            }}
          />
          <span id={`s${i}`}>{test.word}</span>
        </div>
      ))}
      <span id="single">{single && single.word}</span>
    </div>
  );
};

const TestCounter = () => {
  const count = counterSlice.useValue();
  const status = counterSlice.useStatus();

  const incrementAsync = counterSlice.useIncrementAsync();
  const incrementBy = counterSlice.useIncrementByAmount();

  return (
    <div>
      <button onClick={() => incrementAsync(3)}></button>
      <button id="btn2" onClick={() => incrementBy(3)}></button>

      <span>{count}</span>
      <span id="status">{status}</span>
    </div>
  );
};

const TestCounters = () => {
  const main = counters.useMain();
  const list = counters.useList();

  const add = counters.useAdd();

  return (
    <div>
      <button
        onClick={() => {
          main?.incrementAsync(3);
          main?.counterTest?.setSingle({
            word: 'counter',
          } as TestState);
          const counter: Counter = { value: 1, status: 'idle', counterTest: undefined, counterTest2: [] };
          add(counter);
          add({ ...counter, value: 2 });
        }}
      />

      <span id="main">{main?.status == 'loading' ? 'loading' : main?.value ?? 0}</span>
      <span id="test">{main?.counterTest?.single?.word}</span>
      <ul>
        {list.map((l, i) => (
          <li key={i} id={`c${i}`}>
            <button
              id={`b${i}`}
              onClick={() => {
                l.incrementAsync(2);
                l.addTest({ single: { word: 'counter1' } as TestState, list: [] } as TestState2);
                l.addTest({ single: { word: 'counter2' } as TestState, list: [] } as TestState2);
              }}
            ></button>
            <span id={`s${i}`}>{l.status == 'loading' ? 'loading' : l.value}</span>
            <ul>
              {l.counterTest2?.map((a, x) => (
                <li key={`${i}${x}`} id={`l-${i}-${x}`}>
                  {a.single?.word}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

afterEach(cleanup);

describe('index', () => {
  describe('slice', () => {
    it('should render the component', () => {
      const { container } = render(
        <Provider store={store}>
          <TestComponent />
        </Provider>
      );

      expect(container.querySelector('span')).toBeEmptyDOMElement();
      expect(container.querySelector('span[id="sum"')).toHaveTextContent('0');

      const button = container.querySelector('button');
      if (button) fireEvent.click(button);

      expect(container.querySelector('span')).toHaveTextContent('test');
      expect(container.querySelector('span[id="sum"')).toHaveTextContent('3');
    });

    it('should render the component 2', () => {
      const { container } = render(
        <Provider store={store}>
          <TestComponent2 />
        </Provider>
      );

      expect(container.querySelector('h1')).toHaveTextContent('6');

      const button = container.querySelector('#num');
      if (button) fireEvent.click(button);

      expect(container.querySelector('h1')).toHaveTextContent('10');
      expect(container.querySelector('h2')).toHaveTextContent('5');
      expect(container.querySelector('h3')).toHaveTextContent('2');
      expect(container.querySelector('h4')).toHaveTextContent('test2');
      expect(container.querySelector('h5')).toHaveTextContent('3');
      expect(container.querySelector('h6')).toHaveTextContent('2');

      const btnWord = container.querySelector('#word');
      if (btnWord) fireEvent.click(btnWord);

      expect(container.querySelector('h1')).toHaveTextContent('10');
      expect(container.querySelector('h2')).toHaveTextContent('5');
      expect(container.querySelector('h3')).toHaveTextContent('2');
      expect(container.querySelector('h4')).toHaveTextContent('sample2');
      expect(container.querySelector('h5')).toHaveTextContent('3');
      expect(container.querySelector('h6')).toHaveTextContent('3');
    });

    it('should render the component 3', () => {
      const { container } = render(
        <Provider store={store}>
          <TestComponent3 />
        </Provider>
      );

      expect(container.querySelector('span#len')).toHaveTextContent('0');
      expect(container.querySelector('span#single')).toBeEmptyDOMElement();

      const button = container.querySelector('button#add');
      if (button) fireEvent.click(button);

      expect(container.querySelector('span#len')).toHaveTextContent('2');
      expect(container.querySelector('span#s1')).toBeEmptyDOMElement();
      expect(container.querySelector('span#single')).toHaveTextContent('single');

      const b1 = container.querySelector('button#b1');
      if (b1) fireEvent.click(b1);

      expect(container.querySelector('span#s0')).toBeEmptyDOMElement();
      expect(container.querySelector('span#s1')).toHaveTextContent('Test1');
      expect(container.querySelector('span#single')).toHaveTextContent('single1');
    });

    it('should render the counter component', async () => {
      const { container } = render(
        <Provider store={store}>
          <TestCounter />
        </Provider>
      );

      await waitFor(async () => {
        expect(container.querySelector('span')).toHaveTextContent('0');
        expect(container.querySelector('span[id="status"]')).toHaveTextContent('idle');

        const button = container.querySelector('button');
        if (button) fireEvent.click(button);

        expect(container.querySelector('span[id="status"]')).toHaveTextContent('loading');

        await new Promise((r) => setTimeout(r, 500));

        expect(container.querySelector('span')).toHaveTextContent('3');
        expect(container.querySelector('span[id="status"]')).toHaveTextContent('idle');

        const button2 = container.querySelector('button[id="btn2"]');
        if (button2) fireEvent.click(button2);

        expect(container.querySelector('span')).toHaveTextContent('6');
        expect(container.querySelector('span[id="status"]')).toHaveTextContent('idle');
      });
    });

    it('should render the counters component', async () => {
      const { container } = render(
        <Provider store={store}>
          <TestCounters />
        </Provider>
      );

      expect(container.querySelector('span')).toHaveTextContent('0');
      expect(container.querySelector('ul')).toBeEmptyDOMElement();
      expect(container.querySelector('span[id="test"]')).toBeEmptyDOMElement();

      const button = container.querySelector('button');
      if (button) fireEvent.click(button);

      expect(container.querySelector('span')).toHaveTextContent('loading');

      await waitFor(async () => {
        expect(container.querySelector('span')).toHaveTextContent('3');
        expect(container.querySelector('span[id="test"]')).toHaveTextContent('counter');
        expect(container.querySelector('ul span')).toHaveTextContent('1');
        expect(container.querySelector('span[id="s1"]')).toHaveTextContent('2');
      });

      const button2 = container.querySelector('button[id="b1"]');
      if (button2) fireEvent.click(button2);

      expect(container.querySelector('span[id="s1"]')).toHaveTextContent('loading');

      await waitFor(async () => {
        expect(container.querySelector('span[id="s1"]')).toHaveTextContent('4');
        expect(container.querySelector('li[id="l-1-0"]')).toHaveTextContent('counter1');
      });
    });

    it('should throw and slice instance error', () => {
      let err: Error = new Error('');
      try {
        model('test4', testSlice, {});
      } catch (e) {
        err = e as Error;
      }

      expect((err as Error).message).toBe('The whole state cannot be a slice instance');
    });

    it('should throw and duplicate error', () => {
      let err: Error = new Error('');
      try {
        model('test', {}, {});
      } catch (e) {
        err = e as Error;
      }
      expect((err as Error).message).toBe('Duplicate slice name: test');
    });
  });
});

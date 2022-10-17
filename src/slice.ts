import {
  ActionReducerMapBuilder,
  CaseReducerActions,
  createSelector,
  createSlice,
  Dispatch,
  PayloadAction,
  Reducer,
  Selector,
  SliceCaseReducers,
  ValidateSliceCaseReducers,
} from '@reduxjs/toolkit';
import { NoInfer } from '@reduxjs/toolkit/dist/tsHelpers';
import { EqualityFn, useDispatch, useSelector } from 'react-redux';

type SelectorKey<S, R> = { $$selector: Selector<S, R> };

// type AddSelector<Type, Parent> = Type extends (string|number|boolean|Date|string[]|number[]|boolean[]|Date[])
// ? Type & SelectorKey<Parent, Type>
// : WithSelector<Type> & SelectorKey<Parent, Type>

// type WithSelector<T> = { [K in keyof T]: AddSelector<T[K], T> }

type StateActions<A extends CaseReducerActions<SliceCaseReducers<any>>> = {
  [K in keyof A]: (...payloads: Parameters<A[K]>) => Dispatch<ReturnType<A[K]>>;
};

type AddActions<S> = S extends string | number | boolean | Date | string[] | number[] | boolean[] | Date[]
  ? ValidateState<S>
  : S extends Slice
  ? S['$$state'] & StateActions<CaseReducerActions<S['$$actions']>>
  : { [K in keyof S]: AddActions<S[K]> };

type UseFn<S> = <TState = S, Selected = S>(
  selector?: (state: TState) => Selected,
  equalityFn?: EqualityFn<Selected> | undefined
) => AddActions<Selected>;

type AddUseFn<Type> = Type extends string | number | boolean | Date | string[] | number[] | boolean[] | Date[]
  ? Type & { use: UseFn<Type> }
  : WithUseFn<Type> & { use: UseFn<Type> };

type WithUseFn<T> = { [K in keyof T]-?: AddUseFn<T[K]> };

type SelectArgs<T extends unknown[]> = {
  [index in keyof T]: T[index] extends T[number] ? T[index] : unknown;
};

type WithUseAction<T extends CaseReducerActions<SliceCaseReducers<any>>> = {
  [K in keyof T]: T[K] & { use: () => (...payloads: Parameters<T[K]>) => Dispatch<ReturnType<T[K]>> };
};

type ValidateState<S> = S extends string | number | boolean | Date | string[] | number[] | boolean[] | Date[]
  ? S
  : S extends Slice
  ? S['$$state']
  : {
      [K in keyof S]: ValidateState<S[K]>;
    };

export type Slice<
  N extends string = any,
  S = any,
  State extends ValidateState<S> = any,
  A extends ValidateSliceCaseReducers<State, SliceCaseReducers<State>> = any,
  R = any
> = WithUseFn<S> &
  WithUseAction<CaseReducerActions<A>> & {
    $$reducer: R;
    $$name: N;
    $$selector: Selector<ValidateState<S>, ValidateState<S>>;
    $$state: ValidateState<S>;
    $$actions: A;
    use: UseFn<S>;
  };

export function select<D extends unknown[], A extends (...args: SelectArgs<D>) => unknown, R>(
  selectors: [...D],
  select: A
) {
  const parents = (selectors as Array<D[keyof D] & SelectorKey<D[keyof D], D>>).map((s) => s.$$selector);

  const newSelector = createSelector(parents, select as (...args: unknown[]) => R);
  (newSelector as any).use = () => useSelector(newSelector);
  return newSelector as typeof newSelector & { use: () => ReturnType<A> };
}

const selectors: any = {};
const nestedSlices: { [key: string]: string[] } = {};

function withActionProxy<D>(data: D, keys: string[], dispatch: Dispatch): D {
  if (typeof data != 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((d: D[keyof D], i) => withActionProxy(d, [...keys, `${i}`], dispatch)) as D;
  }

  const actions: any = {};
  const fnKey = keys.join('/');
  if (nestedSlices[fnKey]) {
    const acts = nestedSlices[fnKey];

    for (const act of acts) {
      actions[act] = (payload: any) => {
        return dispatch({ type: `${fnKey}/${act}`, payload: { data: payload, keys } });
      };
    }
  }

  const res = {} as D;
  for (const key in data) {
    res[key] = withActionProxy(data[key], [...keys, key], dispatch);
  }

  return { ...res, ...actions };
}

function selectProxy<D>(data: D, keys: string[], selector: any): D {
  const use = (select?: (state: D) => any) => {
    const dispatch = useDispatch();
    const selected = useSelector(select ? createSelector([selector], select) : selector);
    return withActionProxy(selected, keys, dispatch);
  };

  return new Proxy(
    { ...data, $$keys: keys, $$selector: selector, use },
    {
      get(t, k: string) {
        if (k.startsWith('$$')) {
          return t[k as keyof D];
        } else if (k == 'use') {
          return use;
        }

        t.$$keys.push(k);
        const newSelectKey: string = t.$$keys.join('|');

        if (!selectors[newSelectKey]) {
          selectors[newSelectKey] = createSelector([selector], (state: D) => state && state[k as keyof D]);
        }

        return selectProxy(t[k as keyof D], t.$$keys, selectors[newSelectKey]);
      },
    }
  );
}

function getInitial<S>(state: S, cb: (parent: string, state: Slice) => void, parent?: string): ValidateState<S> {
  if (state && (state as Slice).$$reducer) {
    if (parent) {
      cb(parent, state as Slice);
      return (state as Slice).$$state;
    } else {
      throw new Error('The whole state cannot be a slice instance');
    }
  }

  if (Array.isArray(state)) {
    if (state[0] && (state[0] as Slice).$$reducer) {
      cb(parent ? `${parent}/0` : '0', state[0] as Slice);
      return [] as ValidateState<S>;
    }

    return state.map((s, index: number) => getInitial(s, cb, `${index}`)) as ValidateState<S>;
  } else if (typeof state == 'object') {
    if (state) {
      const keys = Object.keys(state);
      if (keys.length) {
        const obj: any = {};

        for (const k of keys) {
          obj[k] = getInitial(state[k as keyof S], cb, k);
        }

        return obj;
      }
    }
  }

  return state as ValidateState<S>;
}

function applyNested<S>(state: S, keys: string[], action: any, reducer: Reducer) {
  const fkey = keys.shift();
  if (fkey) {
    const nKey = parseInt(fkey);
    const key = (isNaN(nKey) ? fkey : nKey) as keyof S;
    if (keys.length) {
      applyNested(state[key as keyof S], keys, action, reducer);
    } else {
      state[key] = reducer(state[key], action);
    }
  }
}

export function slice<
  N extends string,
  S,
  State extends ValidateState<S>,
  A extends ValidateSliceCaseReducers<State, SliceCaseReducers<State>>
>(
  name: N,
  state: S,
  actions: A,
  extra?: ValidateSliceCaseReducers<NoInfer<State>, any> | ((builder: ActionReducerMapBuilder<NoInfer<State>>) => void)
) {
  const nestedActions: ValidateSliceCaseReducers<State, SliceCaseReducers<State>> = {};
  const initialState = getInitial(state, (k, d) => {
    if (nestedSlices[k]) throw new Error(`Duplicate slice name: ${name}`);
    nestedSlices[`${name}/${k}`] = [];
    for (const act in d.$$actions) {
      nestedActions[`${k}/${act}`] = (state, action: PayloadAction<{ data: any; keys: string[] }>) => {
        const keys = action.payload.keys;
        keys.shift(); // remove slice name
        applyNested(state, keys, { type: `${d.$$name}/${act}`, payload: action.payload.data }, d.$$reducer);
      };

      nestedSlices[`${name}/${k}`].push(act);
    }
  }) as State;

  const reducers: A = {
    ...actions,
    ...nestedActions,
  };

  const slice = createSlice<State, SliceCaseReducers<State>, string>({
    name,
    initialState,
    reducers,
    extraReducers: extra,
  });

  if (selectors[name]) throw new Error(`Duplicate slice name: ${name}`);

  selectors[name] = (state: { [key: string]: S }) => {
    return state[name];
  };

  return new Proxy({} as Slice<N, S, State, A, typeof slice.reducer>, {
    get(_target, k: string) {
      if (k == '$$reducer') return slice.reducer;
      if (k == '$$selector') return selectors[name];
      if (k == '$$name') return name;
      if (k == '$$state') return initialState;
      if (k == '$$actions') return slice.actions;
      if (k == 'use') {
        return (select?: (state: State) => any) => {
          const dispatch = useDispatch();
          const selected = useSelector(select ? createSelector([selectors[name]], select) : selectors[name]);
          return withActionProxy(selected, [name], dispatch);
        };
      }

      if (slice.actions[k]) {
        const action = slice.actions[k];
        (action as any).use = () => {
          const dispatch = useDispatch();
          return (payload: any) => dispatch(action(payload));
        };

        return action;
      }

      const keys = [name, k];

      if (!selectors[keys.join('|')]) {
        selectors[keys.join('|')] = createSelector([selectors[name]], (state) => state[k as keyof S]);
      }

      return selectProxy(state[k as keyof S], keys, selectors[keys.join('|')]);
    },
  });
}

import {
  Action,
  CaseReducerActions,
  CreateSliceOptions,
  Dispatch,
  PayloadAction,
  Reducer,
  Slice,
  SliceCaseReducers,
  ValidateSliceCaseReducers,
  createSelector,
  createSlice,
} from '@reduxjs/toolkit';

import { useDispatch, useSelector } from 'react-redux';
import { Selector, SelectorArray } from 'reselect';
import { KeySelector, createCachedSelector } from 're-reselect';

type NativeType = string | number | boolean | Date;

type ActualState<S> = S extends ModelCore
  ? S['$$state']
  : S extends NativeType | NativeType[]
    ? S
    : { [K in keyof S]: ActualState<S[K]> };

type StateActions<A extends CaseReducerActions<SliceCaseReducers<any>, string>> = {
  [K in keyof A]: (
    ...payloads: Parameters<A[K]>
  ) => ReturnType<A[K]> extends Action ? Dispatch<ReturnType<A[K]>> : void;
};

type AddActions<S> = S extends NativeType | NativeType[]
  ? S
  : S extends ModelCore
    ? S['$$state'] & StateActions<CaseReducerActions<S['$$actions'], string>>
    : { [K in keyof S]: AddActions<S[K]> };

type HookFn<S> = () => AddActions<S>;

type AddHookFn<M> = M extends NativeType | unknown[] ? ModelType<M> : WithHookFn<M> & ModelType<M>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractPrivate<T> = T extends `${'use' | '$$'}${infer _X}` ? never : T;

type OnlyPublic<T> = Pick<T, ExtractPrivate<keyof T>>;

type WithHookFn<A, T = Omit<OnlyPublic<A>, 'useAll'>> = { [K in keyof T]-?: AddHookFn<T[K]> } & {
  [K in keyof T as `use${Capitalize<Extract<K, string>>}`]-?: HookFn<T[K]>;
};

type WithHookAction<T extends CaseReducerActions<SliceCaseReducers<any>, string>> = {
  [K in keyof T]-?: {
    useAction: () => (
      ...payloads: Parameters<T[K]>
    ) => ReturnType<T[K]> extends Action ? Dispatch<ReturnType<T[K]>> : void;
  };
} & {
  [K in keyof T as `use${Capitalize<Extract<K, string>>}`]-?: () => (
    ...payloads: Parameters<T[K]>
  ) => ReturnType<T[K]> extends Action ? Dispatch<ReturnType<T[K]>> : void;
};

type ModelType<T> = {
  $$type: T;
  $$selector: Selector<any, ActualState<T>>;
  useAll: HookFn<T>;
};

export type ModelCore<State = any, A = any> = {
  $$reducer: Slice['reducer'];
  $$name: Slice['name'];
  $$state: ActualState<State>;
  $$actions: A;
} & ModelType<State>;

type Model<
  State = any,
  A extends ValidateSliceCaseReducers<ActualState<State>, SliceCaseReducers<ActualState<State>>> = any,
> = ModelCore<State, A> & WithHookFn<State> & WithHookAction<CaseReducerActions<A, string>>;

type ModelTypeArgs<D extends Array<ModelType<any> | Selector<any, any, []>>> = {
  [index in keyof D]: D[index] extends ModelType<any>
    ? D[index]['$$type']
    : D[index] extends Selector
      ? ReturnType<D[index]>
      : never;
};

const $$GENRATE_REDUX = {
  selectors: {} as { [key: string]: any },
  nestedSlices: {} as { [key: string]: string[] },
};

type OmitKeys<K extends any[], T extends any[]> = T extends [...K, ...infer R] ? R : never;

type SelectResult<F extends (...args: any[]) => any, S = any> = {
  (state: S): ReturnType<F>;
  useSelect: () => ReturnType<F>;
};

type SelectResultWithArgs<
  D extends Array<ModelType<any> | Selector<any, any, []>>,
  F extends (...args: any[]) => any,
  S = any,
> = {
  (state: S, ...args: OmitKeys<ModelTypeArgs<D>, Parameters<F>>): ReturnType<F>;
  useSelect: (...args: OmitKeys<ModelTypeArgs<D>, Parameters<F>>) => ReturnType<F>;
};

function selectFn<
  D extends Array<ModelType<any> | Selector<any, any, []>>,
  A extends SelectorArray,
  C extends (...res: [...ModelTypeArgs<D>, ...{ [K in keyof A]: ReturnType<A[K]> }]) => unknown,
  AC extends (...res: ModelTypeArgs<D>) => unknown,
>(selectors: [...D], args: A | never[], combiner: C | AC, keySelector?: KeySelector<any>) {
  const deps = [...selectors.map((selector) => (selector as ModelType<any>).$$selector ?? selector), ...args];

  let selector: any;
  if (args.length > 0) {
    selector = createCachedSelector(
      deps,
      combiner as unknown as (...arg: any[]) => ReturnType<C>
    )(keySelector ?? ((_state, ...args) => args.map((v) => JSON.stringify(v)).join('|')));

    selector.useSelect = (...args: OmitKeys<ModelTypeArgs<D>, Parameters<C>>) =>
      useSelector((state) => {
        return selector(state, ...args);
      });
  } else {
    selector = createSelector(deps, combiner);

    selector.useSelect = () => useSelector(selector);
  }

  return selector as <State = any>(state: State, ...args: OmitKeys<ModelTypeArgs<D>, Parameters<C>>) => ReturnType<C>;
}

export function select<
  D extends Array<ModelType<any> | Selector<any, any, []>>,
  AC extends (...res: ModelTypeArgs<D>) => unknown,
>(selectors: [...D], combiner?: AC): SelectResult<AC>;
export function select<
  D extends Array<ModelType<any> | Selector<any, any, []>>,
  A extends SelectorArray,
  C extends (...res: [...ModelTypeArgs<D>, ...{ [K in keyof A]: ReturnType<A[K]> }]) => unknown,
>(selectors: [...D], args: A, combiner?: C, keySelector?: KeySelector<any>): SelectResultWithArgs<D, C>;
export function select<
  D extends Array<ModelType<any> | Selector<any, any, []>>,
  A extends SelectorArray,
  C extends (...res: [...ModelTypeArgs<D>, ...{ [K in keyof A]: ReturnType<A[K]> }]) => unknown,
  AC extends (...res: ModelTypeArgs<D>) => unknown,
>(selectors: [...D], args: A | AC, combiner?: C, keySelector?: KeySelector<any>) {
  if (Array.isArray(args)) {
    if (combiner) {
      return selectFn(selectors, args as A, combiner, keySelector) as SelectResultWithArgs<D, C>;
    } else {
      throw new Error('Missing Combiner Function');
    }
  }

  return selectFn(selectors, [], args as AC);
}

export const arg =
  <T>(position: number) =>
  (_: any, ...args: any[]) =>
    args[position - 1] as T;

function withActionProxy<D>(data: D, keys: string[], dispatch: Dispatch): D {
  const { nestedSlices } = $$GENRATE_REDUX;
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

function addSelector<D>(key: string, keys: string[], selector: any) {
  const { selectors } = $$GENRATE_REDUX;

  const selectKey: string = [...keys, key].join('|');

  if (!selectors[selectKey]) {
    selectors[selectKey] = createSelector([selector], (state: D) => state && state[key as keyof D]);
  }

  return selectors[selectKey];
}

function selectProxy<D>(data: D, keys: string[], selector: any): D {
  const useAll = () => {
    const dispatch = useDispatch();
    const selected = useSelector(selector);
    return withActionProxy(selected, keys, dispatch);
  };

  return new Proxy(
    { ...data, $$keys: keys, $$selector: selector, useAll },
    {
      get(t, k: string) {
        if (k.startsWith('$$')) {
          return t[k as keyof D];
        } else if (k.startsWith('use')) {
          if (k == 'useAll') {
            return useAll;
          }

          const useKey = k.substring(3);
          const usekey = `${useKey.charAt(0).toLowerCase()}${useKey.substring(1)}`;

          const key = t[useKey as keyof D] ? useKey : usekey;

          const newSelector = addSelector(key, t.$$keys, selector);

          return () => {
            const dispatch = useDispatch();
            const selected = useSelector(newSelector);
            return withActionProxy(selected, [...t.$$keys, key], dispatch);
          };
        }

        const newSelector = addSelector(k, t.$$keys, selector);

        return selectProxy(t[k as keyof D], [...t.$$keys, k], newSelector);
      },
    }
  );
}

function getInitial<S>(state: S, cb: (parent: string, state: Model) => void, parent?: string): ActualState<S> {
  if (state && (state as unknown as Model).$$reducer) {
    if (parent) {
      cb(parent, state as unknown as Model);
      return (state as unknown as Model).$$state;
    } else {
      throw new Error('The whole state cannot be a slice instance');
    }
  }

  if (Array.isArray(state)) {
    if (state[0] && (state[0] as Model).$$reducer) {
      cb(parent ? `${parent}/0` : '0', state[0] as Model);
      return [] as ActualState<S>;
    }

    return state.map((s, index: number) => getInitial(s, cb, `${index}`)) as ActualState<S>;
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

  return state as ActualState<S>;
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

export function model<S, R extends SliceCaseReducers<ActualState<S>>>(
  options: { initialState: S } & Omit<CreateSliceOptions<ActualState<S>, R>, 'initialState'>
) {
  const { name, initialState, reducers } = options;
  const { nestedSlices } = $$GENRATE_REDUX;
  const nestedActions: ValidateSliceCaseReducers<ActualState<S>, SliceCaseReducers<ActualState<S>>> = {};
  const state = getInitial(initialState, (k, d) => {
    if (nestedSlices[k]) throw new Error(`Duplicate slice name: ${name}`);
    nestedSlices[`${name}/${k}`] = [];
    for (const act in d.$$actions) {
      nestedActions[`${k}/${act}`] = (state, action: PayloadAction<{ data: any; keys: string[] }>) => {
        const keys = action.payload.keys;
        keys.shift();
        applyNested(state, keys, { type: `${d.$$name}/${act}`, payload: action.payload.data }, d.$$reducer);
      };

      nestedSlices[`${name}/${k}`].push(act);
    }
  }) as ActualState<S>;

  const slice = createSlice({
    ...options,
    name,
    initialState: state,
    reducers: {
      ...reducers,
      ...nestedActions,
    },
  });

  const { selectors } = $$GENRATE_REDUX;

  if (selectors[name]) throw new Error(`Duplicate slice name: ${name}`);

  selectors[name] = (state: { [key: string]: S }) => {
    return state[name];
  };

  return new Proxy({} as Model<S, R>, {
    get(_target, k: string) {
      if (k == '$$reducer') return slice.reducer;
      if (k == '$$selector') return selectors[name];
      if (k == '$$name') return name;
      if (k == '$$state') return initialState;
      if (k == '$$actions') return slice.actions;

      if (k.startsWith('use')) {
        if (k == 'useAll') {
          return () => {
            const dispatch = useDispatch();
            const selected = useSelector(selectors[name]);
            return withActionProxy(selected, [name], dispatch);
          };
        }

        const useKey = k.substring(3);
        const usekey = `${useKey.charAt(0).toLowerCase()}${useKey.substring(1)}`;

        const action: any = slice.actions[k] || slice.actions[usekey];
        if (action !== undefined) {
          return () => {
            const dispatch = useDispatch();
            return (payload: any) => dispatch(action(payload));
          };
        } else {
          const key = state[useKey as keyof S] ? useKey : usekey;

          const selector = addSelector(key, [name], selectors[name]);

          return () => {
            const dispatch = useDispatch();
            const selected = useSelector(selector);
            return withActionProxy(selected, [name, key], dispatch);
          };
        }
      }

      if (slice.actions[k as keyof typeof slice.actions]) {
        const action: any = slice.actions[k as keyof typeof slice.actions];
        (action as any).useAction = () => {
          const dispatch = useDispatch();
          return (payload: any) => dispatch(action(payload));
        };

        return action;
      }

      return selectProxy(state[k as keyof S], [name, k], addSelector(k, [name], selectors[name]));
    },
  });
}

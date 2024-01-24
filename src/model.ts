import {
  Action,
  CaseReducer,
  CaseReducerActions,
  CreateSliceOptions,
  Dispatch,
  PayloadAction,
  Reducer,
  ReducerCreators,
  Slice,
  SliceCaseReducers,
  ValidateSliceCaseReducers,
  asyncThunkCreator,
  buildCreateSlice,
  createSelector,
} from '@reduxjs/toolkit';

import { useDispatch, useSelector } from 'react-redux';
import { Selector, SelectorArray } from 'reselect';
import { KeySelector, createCachedSelector } from 're-reselect';
import { AsyncThunkSliceReducerDefinition, SliceSelectors } from '@reduxjs/toolkit/dist/createSlice';

type NativeType = string | number | boolean | Date | undefined | null;

type ActualState<S> = S extends ModelCore
  ? ActualState<S['$$type']>
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
    ? S['$$state']
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

type WithHookSelector<T extends SliceSelectors<any>> = {
  [K in keyof T]-?: T[K] & {
    useSelect: () => (...payloads: OmitKeys<[Parameters<T[K]>[0]], Parameters<T[K]>>) => ReturnType<T[K]>;
  };
} & {
  [K in keyof T as `use${Capitalize<Extract<K, string>>}`]-?: (
    ...payloads: OmitKeys<[Parameters<T[K]>[0]], Parameters<T[K]>>
  ) => ReturnType<T[K]>;
};

export type StateType<S> = ActualState<S>;

export type ModelType<T> = {
  $$type: T;
  $$selector: Selector<any, ActualState<T>>;
  useAll: HookFn<T>;
};

export type ModelCore<State = any, A extends SliceCaseReducers<any> = any, S = any> = {
  $$reducer: Slice['reducer'];
  $$asyncReducers: Record<string, { payload: any; config: any }>;
  $$name: Slice['name'];
  $$state: AddActions<State> & StateActions<CaseReducerActions<A, string>>;
  $$actions: A;
  $$selectors: S;
  reducer: () => { [k: Slice['name']]: Slice['reducer'] };
} & ModelType<State>;

type Model<
  State = any,
  A extends SliceCaseReducers<any> = any,
  S extends SliceSelectors<ActualState<State>> = SliceSelectors<ActualState<State>>,
> = ModelCore<State, A, S> & WithHookFn<State> & WithHookAction<CaseReducerActions<A, string>> & WithHookSelector<S>;

type ModelTypeArgs<D extends Array<ModelType<any> | Selector<any, any, []>>> = {
  [index in keyof D]: D[index] extends ModelType<any>
    ? D[index]['$$type']
    : D[index] extends Selector
      ? ReturnType<D[index]>
      : never;
};

const $$GENRATE_REDUX = {
  nestedSelectors: {} as { [key: string]: any },
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

export const createModel = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
});

function selectFn<
  const D extends Array<ModelType<any> | Selector<any, any, []>>,
  const A extends SelectorArray,
  C extends (...res: ModelTypeArgs<[...D, ...A]>) => unknown,
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
  const D extends Array<ModelType<any> | Selector<any, any, []>>,
  AC extends (...res: ModelTypeArgs<D>) => unknown,
>(selectors: [...D], combiner?: AC): SelectResult<AC>;
export function select<
  const D extends Array<ModelType<any> | Selector<any, any, []>>,
  const A extends SelectorArray,
  C extends (...res: ModelTypeArgs<[...D, ...A]>) => unknown,
>(selectors: [...D], args: A, combiner?: C, keySelector?: KeySelector<any>): SelectResultWithArgs<D, C>;
export function select<
  const D extends Array<ModelType<any> | Selector<any, any, []>>,
  const A extends SelectorArray,
  C extends (...res: ModelTypeArgs<[...D, ...A]>) => unknown,
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

function withActionProxy<D, S extends Slice>(data: D, keys: string[], dispatch: Dispatch, slice: S): D {
  const { nestedSlices } = $$GENRATE_REDUX;
  if (typeof data != 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((d: D[keyof D], i) => withActionProxy(d, [...keys, `${i}`], dispatch, slice)) as D;
  }

  const actions: any = {};
  const actionKeys = [...keys];
  const lastKey = actionKeys.pop();
  const fnKey = actionKeys.join('/');
  const actKey = lastKey && isNaN(parseInt(lastKey)) ? lastKey : '[]';
  const sliceKey = [slice.name, fnKey, actKey].filter((a) => !!a).join('/');
  if (nestedSlices[sliceKey]) {
    const acts = nestedSlices[sliceKey];

    for (const act of acts) {
      actions[act] = (payload: any) => {
        const actionKey = [fnKey, actKey, act].filter((a) => !!a).join('/');
        return dispatch((slice.actions as any)[actionKey]({ $$data: payload, $$keys: [...keys] }));
      };
    }
  }

  const res = {} as D;
  for (const key in data) {
    res[key] = withActionProxy(data[key], [...keys, key], dispatch, slice);
  }

  return { ...res, ...actions };
}

function addSelector<D>(key: string, keys: string[], selector: any) {
  const { nestedSelectors } = $$GENRATE_REDUX;

  const selectKey: string = [...keys, key].join('|');

  if (!nestedSelectors[selectKey]) {
    nestedSelectors[selectKey] = createSelector([selector], (state: D) => state && state[key as keyof D]);
  }

  return nestedSelectors[selectKey];
}

function selectProxy<D>(data: D, keys: string[], selector: any, slice: Slice): D {
  const useAll = () => {
    const dispatch = useDispatch();
    const selected = useSelector(selector);
    return withActionProxy(selected, keys, dispatch, slice);
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
            return withActionProxy(selected, [...t.$$keys, key], dispatch, slice);
          };
        }

        const newSelector = addSelector(k, t.$$keys, selector);

        return selectProxy(t[k as keyof D], [...t.$$keys, k], newSelector, slice);
      },
    }
  );
}

function extractInitial<S>(state: S, cb: (parent: string, state: Model) => void, parent?: string) {
  if (Array.isArray(state)) {
    return state.map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      (s, index: number) => getInitial(s, cb, `${index}`)
    ) as ActualState<S>;
  } else if (typeof state == 'object') {
    if (state) {
      const keys = Object.keys(state);
      if (keys.length) {
        const obj: any = {};

        for (const k of keys) {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          obj[k] = getInitial(state[k as keyof S], cb, parent ? `${parent}/${k}` : k);
        }

        return obj;
      }
    }
  }

  return state as ActualState<S>;
}

function getInitial<S>(state: S, cb: (parent: string, state: Model) => void, parent?: string): S {
  if (state) {
    const model = (state as any).$$model;
    if (model) {
      const value = (state as any).$$state;
      if (parent) {
        if (Array.isArray(model)) {
          cb(parent ? `${parent}/[]` : '[]', model[0]);
        } else {
          cb(parent, model);
        }

        return extractInitial(value, cb, parent);
      } else {
        throw new Error('The whole state cannot be a slice instance');
      }
    }
  }

  return extractInitial(state, cb, parent);
}

function applyNested<S>(state: S, keys: string[], action: any, reducer: Reducer) {
  const fkey = keys.shift();
  if (fkey) {
    const nKey = parseInt(fkey);
    const key = (isNaN(nKey) ? fkey : nKey) as keyof S;
    if (keys.length) {
      applyNested(state[key as keyof S], keys, action, reducer);
    } else {
      reducer(state[key], action);
    }
  }
}

export function combineModels(...models: ModelCore[]) {
  let result = {};

  for (const model of models) {
    result = { ...result, ...model.reducer() };
  }

  return result;
}

export function as<Type>(): Type | undefined;
export function as<Type>(defaultValue: Type): Type;
export function as<Type>(defaultValue?: Type) {
  return defaultValue;
}

export function asModel<M extends ModelCore>(model: M): M | undefined;
export function asModel<M extends ModelCore>(model: M, defaultValue: ActualState<M['$$type']>): M;
export function asModel<M extends ModelCore>(model: M, defaultValue?: ActualState<M['$$type']>) {
  return { $$model: model, $$state: defaultValue };
}

export function asModelList<M extends ModelCore>(model: M): M[] | undefined;
export function asModelList<M extends ModelCore>(model: M, defaultValue: Array<ActualState<M['$$type']>>): M[];
export function asModelList<M extends ModelCore>(model: M, defaultValue?: Array<ActualState<M['$$type']>>) {
  return { $$model: [model], $$state: defaultValue } as any;
}

export function model<
  N extends string,
  D,
  R extends SliceCaseReducers<ActualState<D>>,
  S extends SliceSelectors<ActualState<D>>,
>(
  name: N,
  initialState: D,
  reducers:
    | ValidateSliceCaseReducers<ActualState<D>, R>
    | ((creators: Omit<ReducerCreators<ActualState<D>>, 'preparedReducer'>) => R),
  selectors?: S,
  options?: Omit<CreateSliceOptions<ActualState<D>, R>, 'initialState' | 'reducers' | 'selectors'>
) {
  const { nestedSlices } = $$GENRATE_REDUX;
  const nestedReducers: Record<string, CaseReducer<ActualState<D>, PayloadAction<any>>> = {};
  const nestedAsyncReducers: Record<string, { payload: any; config: any; type: string }> = {};

  const state = getInitial(
    initialState,
    // @ts-ignore possile infinite error
    (k, d) => {
      nestedSlices[`${name}/${k}`] = [];
      for (let act in d.$$actions) {
        let parent: string[] = [];
        if (act.indexOf('/') > -1) {
          const keys = act.split('/');
          act = keys.pop() as string;
          parent = [...keys];
        }

        let modelAct = act;
        let sliceKey = `${name}/${k}`;
        if (parent.length) {
          modelAct = `${parent.join('/')}/${act}`;
          sliceKey = `${name}/${k}/${parent.join('/')}`;
        }

        if (d.$$asyncReducers[modelAct]) {
          nestedAsyncReducers[`${k}/${modelAct}`] = { ...d.$$asyncReducers[modelAct], type: `${d.$$name}/${modelAct}` };
        } else {
          nestedReducers[`${k}/${modelAct}`] = (state, action: PayloadAction<{ $$data: any; $$keys: string[] }>) => {
            const keys = action.payload.$$keys;

            const nestedAction = {
              type: `${d.$$name}/${modelAct}`,
              payload: parent.length ? action.payload : action.payload.$$data,
            };

            if (keys.length) {
              applyNested(state, keys, nestedAction, d.$$reducer);
            } else {
              d.$$reducer(state, nestedAction);
            }
          };
        }

        if (!nestedSlices[sliceKey]) {
          nestedSlices[sliceKey] = [];
        }

        nestedSlices[sliceKey].push(act);
      }
    }
  );

  const asyncReducers: Record<string, { payload: any; config: any }> = {};

  const sliceReducers = (creators: ReducerCreators<ActualState<D>>) => {
    let actions: SliceCaseReducers<ActualState<D>> = {};
    if (typeof reducers == 'function') {
      const asyncActions: Array<{ payload: unknown; config: unknown }> = [];

      const asyncThunk: ReducerCreators<ActualState<D>>['asyncThunk'] = (payload: any, config: any) => {
        asyncActions.push({ payload, config });
        return creators.asyncThunk(payload, config);
      };

      asyncThunk.withTypes = creators.asyncThunk.withTypes;

      actions = reducers({ reducer: creators.reducer, asyncThunk });

      if (asyncActions.length) {
        for (const key in actions) {
          const payload = (actions[key] as AsyncThunkSliceReducerDefinition<ActualState<D>, any>).payloadCreator;
          if (payload !== undefined) {
            for (const act of asyncActions) {
              if (payload == act.payload) {
                asyncReducers[key] = act;
              }
            }
          }
        }
      }
    } else {
      for (const reducer in reducers) {
        actions[reducer] = creators.reducer(reducers[reducer] as CaseReducer<ActualState<D>>);
      }
    }

    for (const nr in nestedReducers) {
      actions[nr] = creators.reducer(nestedReducers[nr] as CaseReducer<ActualState<D>>);
    }

    for (const ar in nestedAsyncReducers) {
      const { payload, config, type } = nestedAsyncReducers[ar];

      const asyncConfig: Record<string, CaseReducer<ActualState<D>, PayloadAction<any, any, any>>> = {};

      const configTypes = ['pending', 'fulfilled', 'rejected', 'settled'];

      for (const ctype of configTypes) {
        if (config[ctype]) {
          asyncConfig[ctype] = (state, action) => {
            const keys = [...action.meta.arg.$$keys];
            const data = action.meta.arg.$$data;
            const nestedAction = { ...action, type: `${type}/${ctype}`, payload: data };
            if (!keys.length) {
              config[ctype](state, nestedAction);
            } else {
              applyNested(state, [...keys], nestedAction, config[ctype]);
            }
          };
        }
      }

      actions[ar] = creators.asyncThunk(({ data }, api) => payload(data, api), { ...config, ...asyncConfig });
    }

    return actions;
  };

  const slice = createModel({
    ...options,
    name,
    initialState: state as ActualState<D>,
    reducers: sliceReducers as (creators: ReducerCreators<ActualState<D>>) => R,
    selectors: selectors as SliceSelectors<ActualState<D>>,
  });

  const { nestedSelectors } = $$GENRATE_REDUX;

  if (nestedSelectors[name]) throw new Error(`Duplicate slice name: ${name}`);

  nestedSelectors[name] = (state: { [key: string]: D }) => {
    return state[name];
  };

  return new Proxy(
    // @ts-ignore possible infinite error
    {} as Model<D, R, S>,
    {
      get(_target, k: string) {
        if (k == '$$reducer') return slice.reducer;
        if (k == '$$asyncReducers') return asyncReducers;
        if (k == '$$selector') return nestedSelectors[name];
        if (k == '$$name') return name;
        if (k == '$$state') return initialState;
        if (k == '$$actions') return slice.actions;
        if (k == '$$selectors') return slice.selectors;
        if (k == 'reducer') return () => ({ [name]: slice.reducer });

        if (k.startsWith('use')) {
          if (k == 'useAll') {
            return () => {
              const dispatch = useDispatch();
              const selected = useSelector(nestedSelectors[name]);
              return withActionProxy(selected, [], dispatch, slice);
            };
          }

          const useKey = k.substring(3);
          const usekey = `${useKey.charAt(0).toLowerCase()}${useKey.substring(1)}`;

          const action: any = slice.actions[useKey] || slice.actions[usekey];
          if (action !== undefined) {
            return () => {
              const dispatch = useDispatch();
              return (payload: any) => dispatch(action(payload));
            };
          }

          const selector: any = (slice.selectors as any)[useKey] || (slice.selectors as any)[usekey];
          if (selector) {
            return (...params: any[]) => useSelector((state) => selector(state, ...params));
          }

          const key = state[useKey as keyof D] ? useKey : usekey;

          const nestedSelector = addSelector(key, [name], nestedSelectors[name]);

          return () => {
            const dispatch = useDispatch();
            const selected = useSelector(nestedSelector);
            return withActionProxy(selected, [key], dispatch, slice);
          };
        }

        if (slice.selectors[k as keyof typeof slice.selectors]) {
          const selector: any = (slice.selectors as any)[k];
          (selector as any).useSelect = (...params: any[]) => useSelector((state) => selector(state, ...params));
        }

        if (slice.actions[k as keyof typeof slice.actions]) {
          const action: any = slice.actions[k as keyof typeof slice.actions];
          (action as any).useAction = () => {
            const dispatch = useDispatch();
            return (payload: any) => dispatch(action(payload));
          };

          return action;
        }

        return selectProxy(state[k as keyof D], [name, k], addSelector(k, [name], nestedSelectors[name]), slice);
      },
    }
  );
}

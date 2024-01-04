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

import { EqualityFn, Selector, useDispatch, useSelector } from 'react-redux';

type ValidateState<S> = S extends string | number | boolean | Date | string[] | number[] | boolean[] | Date[]
  ? S
  : S extends Model
    ? S['$$state']
    : { [K in keyof S]: ValidateState<S[K]> };

type StateActions<A extends CaseReducerActions<SliceCaseReducers<any>, string>> = {
  [K in keyof A]: (
    ...payloads: Parameters<A[K]>
  ) => ReturnType<A[K]> extends Action ? Dispatch<ReturnType<A[K]>> : void;
};

type AddActions<S> = S extends string | number | boolean | Date | string[] | number[] | boolean[] | Date[]
  ? ValidateState<S>
  : S extends Model
    ? S['$$state'] & StateActions<CaseReducerActions<S['$$actions'], string>>
    : { [K in keyof S]: AddActions<S[K]> };

type HookFn<S> = <TState = S, Selected = S>(
  selector?: (state: TState) => Selected,
  equalityFn?: EqualityFn<Selected> | undefined
) => AddActions<Selected>;

type AddHookFn<Type> = Type extends string | number | boolean | Date | string[] | number[] | boolean[] | Date[]
  ? Type & { useMe: HookFn<Type> }
  : WithHookFn<Type> & { useMe: HookFn<Type> };

type WithHookFn<T> = { [K in keyof T]-?: AddHookFn<T[K]> };

type WithHookAction<T extends CaseReducerActions<SliceCaseReducers<any>, string>> = {
  [K in keyof T]: T[K] & {
    useMe: () => (...payloads: Parameters<T[K]>) => ReturnType<T[K]> extends Action ? Dispatch<ReturnType<T[K]>> : void;
  };
};

type Model<
  State = any,
  A extends ValidateSliceCaseReducers<ValidateState<State>, SliceCaseReducers<ValidateState<State>>> = any,
> = WithHookFn<State> &
  WithHookAction<CaseReducerActions<A, string>> & {
    $$reducer: Slice['reducer'];
    $$name: Slice['name'];
    $$selector: Selector<ValidateState<State>, ValidateState<State>>;
    $$state: ValidateState<State>;
    $$actions: A;
    useMe: HookFn<State>;
  };

type SelectArgs<T extends unknown[]> = {
  [index in keyof T]: T[index] extends T[number] ? T[index] : unknown;
};

type SelectorKey<S, R> = { $$selector: Selector<S, R> };

const $$GENRATE_REDUX = {
  selectors: {} as { [key: string]: any },
  nestedSlices: {} as { [key: string]: string[] },
};

export function select<D extends unknown[], A extends (...args: SelectArgs<D>) => unknown, R>(
  selectors: [...D],
  select: A
) {
  const parents = (selectors as Array<D[keyof D] & SelectorKey<D[keyof D], D>>).map((s) => s.$$selector);

  const newSelector = createSelector(parents, select as (...args: unknown[]) => R);
  (newSelector as any).useMe = () => useSelector(newSelector);
  return newSelector as typeof newSelector & { useMe: () => ReturnType<A> };
}

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

function selectProxy<D>(data: D, keys: string[], selector: any): D {
  const { selectors } = $$GENRATE_REDUX;

  const useMe = (select?: (state: D) => any) => {
    const dispatch = useDispatch();
    const selected = useSelector(select ? createSelector([selector], select) : selector);
    return withActionProxy(selected, keys, dispatch);
  };

  return new Proxy(
    { ...data, $$keys: keys, $$selector: selector, useMe },
    {
      get(t, k: string) {
        if (k.startsWith('$$')) {
          return t[k as keyof D];
        } else if (k == 'useMe') {
          return useMe;
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

function getInitial<S>(state: S, cb: (parent: string, state: Model) => void, parent?: string): ValidateState<S> {
  if (state && (state as Model).$$reducer) {
    if (parent) {
      cb(parent, state as Model);
      return (state as Model).$$state;
    } else {
      throw new Error('The whole state cannot be a slice instance');
    }
  }

  if (Array.isArray(state)) {
    if (state[0] && (state[0] as Model).$$reducer) {
      cb(parent ? `${parent}/0` : '0', state[0] as Model);
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

export function model<S, A extends SliceCaseReducers<ValidateState<S>>>(
  options: CreateSliceOptions<ValidateState<S>, A>
) {
  const { name, initialState, reducers } = options;
  const { nestedSlices } = $$GENRATE_REDUX;
  const nestedActions: ValidateSliceCaseReducers<ValidateState<S>, SliceCaseReducers<ValidateState<S>>> = {};
  const state = getInitial(initialState, (k, d) => {
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
  }) as ValidateState<S>;

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

  return new Proxy({} as Model<S, A>, {
    get(_target, k: string) {
      if (k == '$$reducer') return slice.reducer;
      if (k == '$$selector') return selectors[name];
      if (k == '$$name') return name;
      if (k == '$$state') return initialState;
      if (k == '$$actions') return slice.actions;
      if (k == 'useMe') {
        return (select?: (state: S) => any) => {
          const dispatch = useDispatch();
          const selected = useSelector(select ? createSelector([selectors[name]], select) : selectors[name]);
          return withActionProxy(selected, [name], dispatch);
        };
      }

      if (slice.actions[k as keyof typeof slice.actions]) {
        const action: any = slice.actions[k as keyof typeof slice.actions];
        (action as any).useMe = () => {
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

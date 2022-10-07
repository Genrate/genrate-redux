import {
  ActionReducerMapBuilder,
  CaseReducerActions,
  createSelector,
  createSlice,
  Dispatch,
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

type UseFn<S> = <TState = S, Selected = S>(
  selector?: (state: TState) => Selected,
  equalityFn?: EqualityFn<Selected> | undefined
) => Selected;

type AddUseFn<Type> = Type extends string | number | boolean | Date | string[] | number[] | boolean[] | Date[]
  ? Type & { use: UseFn<Type> }
  : WithUseFn<Type> & { use: UseFn<Type> };

type WithUseFn<T> = { [K in keyof T]: AddUseFn<T[K]> };

type SelectArgs<T extends unknown[]> = {
  [index in keyof T]: T[index] extends T[number] ? T[index] : unknown;
};

type WithUseAction<T extends CaseReducerActions<SliceCaseReducers<any>>> = {
  [K in keyof T]: T[K] & { use: () => (...payloads: Parameters<T[K]>) => Dispatch<ReturnType<T[K]>> };
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

function selectProxy<D>(data: D, keys: string[], selector: any): D {
  const use = (select?: (state: D) => any) => useSelector(select ? createSelector([selector], select) : selector);

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
        const newSelectKey = t.$$keys.join('|');

        if (!selectors[newSelectKey]) {
          selectors[newSelectKey] = createSelector([selector], (state: D) => state && state[k as keyof D]);
        }

        return selectProxy(t[k as keyof D], t.$$keys, selectors[newSelectKey]);
      },
    }
  );
}

export function slice<N extends string, S, A extends ValidateSliceCaseReducers<S, SliceCaseReducers<S>>>(
  name: N,
  state: S,
  actions: A,
  extra?: ValidateSliceCaseReducers<NoInfer<S>, any> | ((builder: ActionReducerMapBuilder<NoInfer<S>>) => void)
) {
  const reducers: A = {
    ...actions,
  };

  const slice = createSlice<S, SliceCaseReducers<S>, string>({
    name,
    initialState: state,
    reducers,
    extraReducers: extra,
  });

  if (selectors[name]) throw new Error(`Duplicate model name: ${name}`);

  selectors[name] = (state: { [key: string]: S }) => state[name];

  type ProxyType = WithUseFn<S> &
    WithUseAction<CaseReducerActions<A>> & {
      $$reducer: typeof slice.reducer;
      $$name: N;
      $$selector: Selector<S, S>;
      $$type: S;
      use: UseFn<S>;
    };

  return new Proxy({} as ProxyType, {
    get(_target, k: string) {
      if (k == '$$reducer') return slice.reducer;
      if (k == '$$selector') return selectors[name];
      if (k == '$$name') return name;
      if (k == 'use') {
        return (select?: (state: S) => any) =>
          useSelector(select ? createSelector([selectors[name]], select) : selectors[name]);
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

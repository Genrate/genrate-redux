# GenRate React

[![npm package][npm-img]][npm-url] [![Build Status][build-img]][build-url] [![Downloads][downloads-img]][downloads-url] [![Issues][issues-img]][issues-url] [![codecov][codecov-img]][codecov-url] [![Commitizen Friendly][commitizen-img]][commitizen-url] [![Semantic Release][semantic-release-img]][semantic-release-url]

> GenRate React Redux package aims simplify redux implementation

## Install

```bash
npm install @genrate/react-redux
```

## Usage

### Slice
```ts
import { model } from '@genrate/react-redux'
import { PayloadAction } from '@reduxjs/toolkit';

export type UserType = {
  email: string,
  password: string,
  remember: string,
}

const initialState = {} as UserType

export default model({
  
  // redux state name
  name: 'user', 
  
  // initial state value
  initialState, 
  
  // action reducers
  reducers: {
    set(state, action: PayloadAction<UserType>) {
      Object.assign(state, action.payload)
    }
  }
})

```

### Slice in react

```ts
import User from './models/user'

const Component = () => {

  // auto memoized selector
  const user = User.use(); // eq = useSelector(state => state.user)

  // deep selector

  const deep = User.sample.data.use() 

  // sampe as 
  // const main = (state) => state.user;
  // const sample = createSelector([main], state => state.sample)
  // const data = createSelector([sample], state => state.data)
  // const deep = useSelector(data);

  // get action with dispatch
  const setUser = User.set.use();


  return (
    <div>
      <span> {user && user.email} </span>
      <button onClick={() => setUser({ email: 'test@gmail' })} /> 
    <div>
  )
}

```
### RTX Query 
```ts
import { fetch } from '@genrate/react-redux'

const { api, get, post } = fetch('posts')

type User = {
  id: number,
  name: string
}

const UserApi = api({
  getOne: get<User, number>((id) => `users/${id}`),
  update: post<User, Partial<User>>((update) => ({ url: `users/${id}`, body: update }))
  // test: get<User, number>(
  //   (id) => `users/${id}`, {
  //     transform: (res) => res.data,
  //     tags: (_post, _err, id) => [{ type: 'Posts', id: }] // provideTags
  //   } 
  // )
})


function Component () => {
  
  const [user, { isFetching }] = UserApi.useGetQuery(1);
  const [updateUser, { isLoading }] = UserApi.useUpdateMutation())

  return (
    <div> 
      {isFetching ? 'Loading' : user.name }
      <button onClick={() => updateUser({ name: 'test' })} />
    </div>
  )
}


```
[build-img]: https://github.com/GenRate/genrate-react-redux/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/GenRate/genrate-react-redux/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/@genrate/react-redux
[downloads-url]: https://www.npmtrends.com/@genrate/react-redux
[npm-img]: https://img.shields.io/npm/v/@genrate/react-redux
[npm-url]: https://www.npmjs.com/package/@genrate/react-redux
[issues-img]: https://img.shields.io/github/issues/GenRate/genrate-react-redux
[issues-url]: https://github.com/GenRate/genrate-react-redux/issues
[codecov-img]: https://codecov.io/gh/GenRate/genrate-react-redux/branch/master/graph/badge.svg?token=A0V6BNMPRY
[codecov-url]: https://codecov.io/gh/GenRate/genrate-react-redux
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/

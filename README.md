# GenRate Redux

[![npm package][npm-img]][npm-url] [![Build Status][build-img]][build-url] [![Downloads][downloads-img]][downloads-url] [![Issues][issues-img]][issues-url] [![codecov][codecov-img]][codecov-url] [![Commitizen Friendly][commitizen-img]][commitizen-url] [![Semantic Release][semantic-release-img]][semantic-release-url]

> GenRate Redux package aims simplify redux implementation

## Install

```bash
npm install @genrate/redux
```

## Usage

### Slice
```ts
import { model, as  } from '@genrate/redux'
import { PayloadAction } from '@reduxjs/toolkit';

const state = {
  email: as<string>('test@sample.com'), // required
  password: as<string>(), // optional
  remember: as<boolean | undefined>(false), // optional with default
  profile: {
    name: as<string>();
    hobbies: as<string[]>();
  }
}

export type UserState = typeof state;

export default model(
  'user', // slice name
  state, // slice state
  { 
    // reducers
    set(state, action: PayloadAction<UserState>) {
      Object.assign(state, action.payload)
    }
  }, {
    // selectors
    isPlayingBasketball: (state) => state.profile?.hobbies?.indexOf('basketball') > -1
  }
)

```

### Nested Slice

```tsx
import { model, as, asModelList, StateType } from '@genrate/redux'
import { PayloadAction } from '@reduxjs/toolkit';

const commentState = { 
  message: as<string>(), 
  likes: as<number>(0) 
};

const Comment =  model('comment', commentState, {
  set(state, action: PayloadAction<string>) {
    state.message = action.payload
  },
  addLike(state) {
    state.likes += 1
  }
})

const postState = {
  content: as<string>(),
  newCommentStatus: as<string>('idle'),
  comments: asModelList(Comment, []) // as type model array
}

type PostState = StateType<typeof postState>

const Post = model('post', postState, 
  
  // ReducerCreators
  ({ reducer, asyncThunk }) => ({ 
    set: reducer<string>(state, { payload }) {
      state.content = payload
    },
    addComment: asyncThunk(  // async reducer
      async (comment: string) => {
        const response = await apiAddComment(comment)
        return response.data
      },
      {
        pending: state => {
          state.newCommentStatus = "loading"
        },
        fulfilled: (state, action) => {
          state.newCommentStatus = "idle"
          state.message = action.payload
        },
        rejected: state => {
          state.newCommentStatus = "failed"
        },
      },
    )

  // selectors
  }), {
    commentsWithLikes: (state) => state.comments.filter(c => c.likes > 0)
  }
)

// usage in react 

const Post = () => {
  const content = Post.useContent()
  const comments = Post.useCommentsWithLikes();

  const addComment = Post.useAddComment();
  
  return (
    <div>
      <span>
        {content}
      </span>
      {comments.map(
        (comment, i) => (
          <div key={i}>
            <button onClick={() => comment.addLike()} /> // inherit model actions
            <span>
              {comment.message}
            </span>
          </div>
        )
      )}
    </div>
  )
}

```

### Selector 

```ts
import { select, arg } from '@genrate/redux'
import User from './models/user'

const getProfileName = select([User.profile], (profile) => profile.name);

// selector with arguments
const hasHobby = select(
  [User.profile.hobbies],
  [arg<string>(1)],
  (hobbies, hobby) => hobbies.find(h => h == hobby);
)

// using on react 
const name = useSelector(getProfile); // 
const name = getProfile.useSelect();

// with arguments
const isPlayingBadminton = useSelector(state => hasHobby(state, 'badminton'));
const isPlayingBasketball = hasHobby.useSelect('basketball');

```

### Slice in react

```tsx
import User from './models/user'

const Component = () => {

  // auto memoized selector
  const user = User.useAll(); // eq = useSelector(state => state.user)

  // deep selector

  // sampe as 
  // cachedUser = (state) => state.user;
  // cachedProfile = createSelector([main], state => state.profile)
  // cachedName = createSelector([profile], state => state.name)
  // deep = useSelector(name);
  const name = User.profile.useName() 

  // get action with dispatch
  const setUser = User.useSet();

  return (
    <div>
      <span> {user && user.email} </span>
      <button onClick={() => setUser({ email: 'test@gmail' })} /> 
    <div>
  )
}

```
### RTX Query 
```tsx
import { fetch } from '@genrate/redux'

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
[build-img]: https://github.com/GenRate/genrate-redux/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/GenRate/genrate-redux/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/@genrate/redux
[downloads-url]: https://www.npmtrends.com/@genrate/redux
[npm-img]: https://img.shields.io/npm/v/@genrate/redux
[npm-url]: https://www.npmjs.com/package/@genrate/redux
[issues-img]: https://img.shields.io/github/issues/GenRate/genrate-redux
[issues-url]: https://github.com/GenRate/genrate-redux/issues
[codecov-img]: https://codecov.io/gh/GenRate/genrate-redux/branch/master/graph/badge.svg?token=A0V6BNMPRY
[codecov-url]: https://codecov.io/gh/GenRate/genrate-redux
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/

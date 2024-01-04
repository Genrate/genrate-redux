import * as React from 'react'
import { ApiProvider, createApi } from '@reduxjs/toolkit/query/react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { request, fetch } from '../../src/api'

export const DEFAULT_DELAY_MS = 150

export async function waitMs(time = DEFAULT_DELAY_MS) {
  const now = Date.now()
  while (Date.now() < now + time) {
    await new Promise((res) => process.nextTick(res))
  }
}

const { api, get, post } = request('Posts', async (arg: any) => {
  await waitMs()
  return { data: arg?.body ? arg.body : null }
})

const UserApi = api({
  get: get<any, number>((num) => num),
  update: post<any, { name: string}>((name) => ({ body: name }))
})

describe('ApiProvider', () => {
  test('ApiProvider allows a user to make queries without a traditional Redux setup', async () => {
    function User() {
      const [value, setValue] = React.useState(0)
      
      const { isFetching } = UserApi.useGetQuery(1, {
        skip: value < 1,
      })

      return (
        <div>
          <div data-testid="isFetching">{String(isFetching)}</div>
          <button onClick={() => setValue((val) => val + 1)}>
            Increment value
          </button>
        </div>
      )
    }

    const { getByText, getByTestId } = render(
      <ApiProvider api={UserApi}>
        <User />
      </ApiProvider>
    )

    await waitFor(() =>
      expect(getByTestId('isFetching').textContent).toBe('false')
    )
    fireEvent.click(getByText('Increment value'))
    await waitFor(() =>
      expect(getByTestId('isFetching').textContent).toBe('true')
    )
    await waitFor(() =>
      expect(getByTestId('isFetching').textContent).toBe('false')
    )
    fireEvent.click(getByText('Increment value'))
    // Being that nothing has changed in the args, this should never fire.
    expect(getByTestId('isFetching').textContent).toBe('false')
  })
})
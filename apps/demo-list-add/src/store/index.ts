/**
 * Redux store configuration for demo-list-add
 */

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@dtsl/rtk-query/react';
import { api } from '../api';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

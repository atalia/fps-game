/**
 * @fileoverview Tests for RuntimeAssets - imported asset caching with graceful fallback
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const runtimeAssetsCode = readFileSync(`${__dirname}/../assets/runtime-assets.js`, 'utf8')

function loadRuntimeAssets() {
  const context = {
    window: {},
  }
  const fn = new Function('window', runtimeAssetsCode)
  fn(context.window)
  return context.window.RuntimeAssets
}

const RuntimeAssets = loadRuntimeAssets()

describe('RuntimeAssets', () => {
  let fakeLoader
  let fallbackFactory

  beforeEach(() => {
    fakeLoader = vi.fn()
    fallbackFactory = vi.fn((key, source, error) => ({ id: 'fallback', key, source }))
  })

  test('runtime asset loader caches imported assets and falls back when a source is missing', async () => {
    const runtime = new RuntimeAssets({
      loader: fakeLoader,
      fallbackFactory: fallbackFactory,
    })

    fakeLoader
      .mockResolvedValueOnce({ id: 'env-kit' })
      .mockRejectedValueOnce(new Error('404 Not Found'))

    const first = await runtime.load('arena-core', '/assets/models/arena-core.glb')
    const second = await runtime.load('arena-core', '/assets/models/arena-core.glb')
    const fallback = await runtime.load('missing-kit', '/assets/models/missing.glb')

    expect(first).toEqual({ id: 'env-kit' })
    expect(second).toBe(first)
    expect(fallback).toEqual({ id: 'fallback', key: 'missing-kit', source: '/assets/models/missing.glb' })
    expect(fakeLoader).toHaveBeenCalledTimes(2)
  })

  test('returns cached assets without calling loader again', async () => {
    const runtime = new RuntimeAssets({
      loader: fakeLoader,
      fallbackFactory: fallbackFactory,
    })

    fakeLoader.mockResolvedValue({ id: 'test-asset' })

    await runtime.load('key1', '/path1.glb')
    await runtime.load('key1', '/path1.glb')
    await runtime.load('key1', '/path1.glb')

    expect(fakeLoader).toHaveBeenCalledTimes(1)
  })

  test('calls loader with source path', async () => {
    const runtime = new RuntimeAssets({
      loader: fakeLoader,
      fallbackFactory: fallbackFactory,
    })

    fakeLoader.mockResolvedValue({ id: 'loaded' })

    await runtime.load('my-asset', '/assets/models/my-asset.glb')

    expect(fakeLoader).toHaveBeenCalledWith('/assets/models/my-asset.glb')
  })

  test('caches fallback results to avoid repeated error handling', async () => {
    const runtime = new RuntimeAssets({
      loader: fakeLoader,
      fallbackFactory: fallbackFactory,
    })

    fakeLoader.mockRejectedValue(new Error('404 Not Found'))

    const firstFallback = await runtime.load('missing', '/missing.glb')
    const secondFallback = await runtime.load('missing', '/missing.glb')

    expect(fakeLoader).toHaveBeenCalledTimes(1)
    expect(fallbackFactory).toHaveBeenCalledTimes(1)
    expect(firstFallback).toBe(secondFallback)
  })

  test('passes error to fallbackFactory', async () => {
    const runtime = new RuntimeAssets({
      loader: fakeLoader,
      fallbackFactory: fallbackFactory,
    })

    const testError = new Error('Network error')
    fakeLoader.mockRejectedValue(testError)

    await runtime.load('error-asset', '/error.glb')

    expect(fallbackFactory).toHaveBeenCalledWith('error-asset', '/error.glb', testError)
  })

  test('constructor stores loader and fallbackFactory', () => {
    const runtime = new RuntimeAssets({
      loader: fakeLoader,
      fallbackFactory: fallbackFactory,
    })

    expect(runtime.loader).toBe(fakeLoader)
    expect(runtime.fallbackFactory).toBe(fallbackFactory)
    expect(runtime.cache).toBeInstanceOf(Map)
  })

  test('handles multiple different assets independently', async () => {
    const runtime = new RuntimeAssets({
      loader: fakeLoader,
      fallbackFactory: fallbackFactory,
    })

    fakeLoader
      .mockResolvedValueOnce({ id: 'asset-a' })
      .mockResolvedValueOnce({ id: 'asset-b' })

    const assetA = await runtime.load('key-a', '/a.glb')
    const assetB = await runtime.load('key-b', '/b.glb')

    expect(assetA).toEqual({ id: 'asset-a' })
    expect(assetB).toEqual({ id: 'asset-b' })
    expect(fakeLoader).toHaveBeenCalledTimes(2)
  })
})
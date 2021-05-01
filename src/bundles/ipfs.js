import root from 'window-or-global'

const defaultState = {
  apiOpts: {
    host: '127.0.0.1',
    port: '5001',
    protocol: 'http'
  },
  provider: null, // 'window.ipfs' | 'js-ipfs-api' | 'js-ipfs'
  ipfsReady: false
}

export default {
  name: 'ipfs',

  reducer(state, { type, payload, error }) {
    state = state || defaultState
    if (type === 'IPFS_INIT_FINISHED') {
      return Object.assign({}, state, {
        ipfsReady: true,
        identity: payload.identity,
        provider: payload.provider,
        apiOts: payload.apiOpts || state.apiOpts
      })
    }

    if (type === 'IPFS_INIT_FAILED') {
      return Object.assign({}, state, { ipfsReady: false, error: error })
    }

    return state
  },

  getExtraArgs() {
    return { getIpfs: () => root._ipfs }
  },

  selectIpfsReady: state => state.ipfs.ipfsReady,

  selectIpfsIdentity: state => state.ipfs.identity,

  doInitIpfs: () => async ({ dispatch, getState }) => {
    console.log('Looking for IPFS')
    console.time('IPFS_INIT')
    dispatch({ type: 'IPFS_INIT_STARTED' })

    let ipfs = null
    let identity = null

    // TRY window.ipfs!
    if (root.ipfs) {
      // no-op for now
      // TODO: after switch to latest js-ipfs (with async iterators) use https://github.com/ipfs-shipyard/ipfs-provider
    }

    // TRY js-ipfs-api!
    const apiOpts = Object.assign(
      {},
      getState().ipfs.apiOpts,
      getUserOpts('ipfsApi')
    )
    try {
      console.time('IPFS_INIT_API')
      const { default: ipfsClient } = await import('ipfs-http-client')
      console.log('Trying ipfs-http-client', apiOpts)
      console.info(
        "🎛️ Customise your js-ipfs-api opts by setting an `ipfsApi` value in localStorage. e.g. localStorage.setItem('ipfsApi', JSON.stringify({port: '1337'}))"
      )
      ipfs = ipfsClient(apiOpts)
      identity = await ipfs.id()
      console.log('js-ipfs-api ready!')
      root._ipfs = ipfs
      console.timeEnd('IPFS_INIT_API')
      console.timeEnd('IPFS_INIT')
      return dispatch({
        type: 'IPFS_INIT_FINISHED',
        payload: {
          identity,
          provider: 'js-ipfs-api',
          apiOpts
        }
      })
    } catch (error) {
      console.log('No ipfs-api found', error)
    }

    const ipfsOpts = getUserOpts('ipfsOpts')
    // TRY js-ipfs!
    try {
      console.time('IPFS_INIT_JS_IPFS')
      console.log('Trying js-ipfs', ipfsOpts)
      console.info(
        "🎛️ Customise your js-ipfs opts by setting an `ipfsOpts` value in localStorage. e.g. localStorage.setItem('ipfsOpts', JSON.stringify({relay: {enabled: true}}))"
      )
      const { default: Ipfs } = await import('ipfs')
      console.log('got Ipfs')
      const ipfs = await Ipfs.create(ipfsOpts)
      console.log('got ipfs')
      identity = await ipfs.id()
      console.log('js-ipfs ready!')
      root._ipfs = ipfs
      console.timeEnd('IPFS_INIT_JS_IPFS')
      console.timeEnd('IPFS_INIT')
      return dispatch({
        type: 'IPFS_INIT_FINISHED',
        payload: {
          identity,
          provider: 'js-ipfs'
        }
      })
    } catch (error) {
      if (error.message && error.message.includes('subtle is undefined')) {
        console.warn('IPLD Explorer requires access to window.crypto, redirecting to canonical URL that is known to provide it in all browsers')
        // This error means js-ipfs was loaded in a context that is not marked
        // as Secure Context by the browser vendor.  (example: *.localhost in
        // Firefox until https://bugzilla.mozilla.org/show_bug.cgi?id=1220810
        // is addresssed)
        // This is difficult to debug for regular user, as Explorer simply fails to load anything from IPFS.
        // For now, we detect this failure and redirect to canonical version with TLS, so it always works.
        const url = new URL('https://explore.ipld.io/?x-ipfs-companion-no-redirect')
        url.hash = window.location.hash
        window.location.replace(url.toString())
        return
      }
      console.log('Failed to initialise js-ipfs', error)
      console.timeEnd('IPFS_INIT')
      return dispatch({ type: 'IPFS_INIT_FAILED', error })
    }
  }
}

function getUserOpts(key) {
  let userOpts = {}
  if (root.localStorage) {
    try {
      const optsStr = root.localStorage.getItem(key) || '{}'
      userOpts = JSON.parse(optsStr)
    } catch (error) {
      console.log(`Error reading '${key}' value from localStorage`, error)
    }
  }
  return userOpts
}

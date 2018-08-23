/* global it expect jest */
import {DAGNode} from 'ipld-dag-pb'
import {
  resolveIpldPath,
  findLinkPath
} from './resolve-ipld-path'

// TODO: Figure out how to mock the block store for IPLD resolver
it.skip('resolves all nodes traversed along a path', async () => {
  const dagGetMock = jest.fn()
  const getIpfsMock = () => ({dag: {get: dagGetMock}})
  const cid = 'zdpuAs8sJjcmsPUfB1bUViftCZ8usnvs2cXrPH6MDyT4zrvSs'
  const path = '/a/b/a'
  const linkCid = 'zdpuAyzU5ahAKr5YV24J5TqrDX8PhzHLMkxx69oVzkBDWHnjq'
  const dagGetRes1 = {
    remainderPath: 'a',
    value: {
      a: {
        b: {
          '/': linkCid
        }
      }
    }
  }
  const dagGetRes2 = {
    remainderPath: '',
    value: 'hello world'
  }

  dagGetMock.mockReturnValueOnce(Promise.resolve(dagGetRes1))
  dagGetMock.mockReturnValueOnce(Promise.resolve(dagGetRes2))

  const res = await resolveIpldPath(getIpfsMock, cid, path)

  expect(dagGetMock.mock.calls.length).toBe(2)
  expect(res.canonicalPath).toBe(`${linkCid}/a`)
  expect(res.nodes.length).toBe(2)
  expect(res.nodes[0].type).toBe('dag-cbor')
  expect(res.nodes[0].cid).toBe(cid)
  expect(res.nodes[1].type).toBe('dag-cbor')
  expect(res.nodes[1].cid).toBe(linkCid)
  expect(res.pathBoundaries.length).toBe(1)
  expect(res.pathBoundaries[0]).toEqual({
    path: 'a/b',
    source: cid,
    target: linkCid
  })
})

// TODO: Figure out how to mock the block store for IPLD resolver
it.skip('resolves thru dag-cbor to dag-pb to dag-pb', async () => {
  const dagGetMock = jest.fn()
  const getIpfsMock = () => ({dag: {get: dagGetMock}})

  const cid = 'zdpuAs8sJjcmsPUfB1bUViftCZ8usnvs2cXrPH6MDyT4zrvSs'
  const path = '/a/b/pb1'

  const dagNode3 = await createDagPbNode(Buffer.from('the second pb node'), [])

  const dagNode2 = await createDagPbNode(Buffer.from('the first pb node'), [{
    name: 'pb1',
    multihash: dagNode3.toJSON().multihash,
    size: 101
  }])

  const dagNode1 = {
    a: {
      b: {
        '/': dagNode2.toJSON().multihash
      }
    }
  }

  const dagGetRes1 = {
    remainderPath: 'pb1',
    value: dagNode1
  }

  const dagGetRes2 = {
    remainderPath: '',
    value: dagNode2
  }

  const dagGetRes3 = {
    remainderPath: '',
    value: dagNode3
  }

  dagGetMock.mockReturnValueOnce(Promise.resolve(dagGetRes1))
  dagGetMock.mockReturnValueOnce(Promise.resolve(dagGetRes2))
  dagGetMock.mockReturnValueOnce(Promise.resolve(dagGetRes3))

  const res = await resolveIpldPath(getIpfsMock, cid, path)

  expect(dagGetMock.mock.calls.length).toBe(3)
  expect(res.targetNode.cid).toEqual(dagNode3.toJSON().multihash)
  expect(res.canonicalPath).toBe(dagNode3.toJSON().multihash)
  expect(res.nodes.length).toBe(3)
  expect(res.nodes[0].type).toBe('dag-cbor')
  expect(res.nodes[0].cid).toBe(cid)
  expect(res.nodes[0].links.length).toBe(1)
  expect(res.nodes[1].type).toBe('dag-pb')
  expect(res.nodes[1].cid).toBe(dagNode2.toJSON().multihash)
  expect(res.nodes[1].links.length).toBe(1)
  expect(res.nodes[2].type).toBe('dag-pb')
  expect(res.nodes[2].cid).toBe(dagNode3.toJSON().multihash)
  expect(res.nodes[2].links.length).toBe(0)
  expect(res.pathBoundaries.length).toBe(2)
  expect(res.pathBoundaries[0]).toEqual({
    path: 'a/b',
    source: cid,
    target: dagNode2.toJSON().multihash
  })
  expect(res.pathBoundaries[1]).toEqual({
    path: 'pb1',
    size: dagNode2.toJSON().links[0].size,
    source: dagNode2.toJSON().multihash,
    target: dagNode3.toJSON().multihash
  })
})

function createDagPbNode (data, links) {
  return new Promise((resolve, reject) => {
    DAGNode.create(data, links, (err, dagNode) => {
      if (err) return reject(err)
      resolve(dagNode)
    })
  })
}

it('finds the linkPath from a fullPath and a remainderPath', () => {
  expect(findLinkPath('', '')).toBe(null)
  expect(findLinkPath('/', '')).toBe(null)
  expect(findLinkPath('/foo/bar', 'bar')).toBe('foo')
  expect(findLinkPath('/a/b/c/a', 'b/c/a')).toBe('a')
  expect(findLinkPath('/a/b/c/a', '/b/c/a')).toBe('a')
  expect(findLinkPath('a/b/c/a', '/b/c/a')).toBe('a')
  expect(() => findLinkPath('/foo', 'wat')).toThrow()
})

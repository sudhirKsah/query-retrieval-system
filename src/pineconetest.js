const { Pinecone } = require('@pinecone-database/pinecone');
const pinecone = new Pinecone({
  apiKey: 'pcsk_r6beP_7HPuixeHeD3aGi7PG4Fy8vtAdva6NeKTRkAEYphyFw5TKeKV1FvF4Jit4qDmzjZ',
//   environment: 'us-east-1'
});
pinecone.listIndexes().then(console.log).catch(console.error);
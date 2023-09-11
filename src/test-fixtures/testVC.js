export default { 
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://purl.imsglobal.org/spec/ob/v3p0/context.json",
          "https://w3id.org/vc/status-list/2021/v1"
    ],
    "id": "urn:uuid:951b475e-b795-43bc-ba8f-a2d01efd2eb1", 
    "type": [
      "VerifiableCredential",
      "OpenBadgeCredential"
    ],
    "issuer": {
      "id": "did:key:z6MkhVTX9BF3NGYX6cc7jWpbNnR7cAjH8LUffabZP8Qu4ysC", 
      "type": "Profile",
      "name": "University of Wonderful",
      "description":   "The most wonderful university",
      "url": "https://wonderful.edu/",
      "image": {
          "id": "https://user-images.githubusercontent.com/947005/133544904-29d6139d-2e7b-4fe2-b6e9-7d1022bb6a45.png",
          "type": "Image"
        }	
    },
    "issuanceDate": "2020-01-01T00:00:00Z", 
    "name": "A Simply Wonderful Course",
    "credentialSubject": {
        "type": "AchievementSubject",
       "achievement": {
        "id": "http://wonderful.wonderful",
        "type": "Achievement",
        "criteria": {
          "narrative": "Completion of the Wonderful Course - well done you!"
        },
        "description": "Wonderful.", 
        "name": "Introduction to Wonderfullness"
      }
    }
  }
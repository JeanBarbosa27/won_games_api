'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

const axios = require('axios')
const slugify = require('slugify')

async function getGameInfo(slug) {
  const jsdom = require('jsdom')
  const { JSDOM } = jsdom
  const { data } = await axios.get(`https://www.gog.com/game/${slug}`)
  const dom = new JSDOM(data)

  const ratingElement = dom.window.document.querySelector('.age-restrictions__icon use')
  const descriptionElement = dom.window.document.querySelector('.description')

  return {
    rating: ratingElement
              ? ratingElement
                  .getAttribute('xlink:href')
                  .replace(/_/g, '')
                  .replace(/[^\w-]+/g, '')
              : 'br0',
    short_description: descriptionElement.textContent.trim().slice(0, 160),
    description: descriptionElement.innerHTML
  }
}

async function handleRelationCreation(relationType, name) {
  const findRelation = await strapi.services[relationType].findOne({ name: name })

  console.log('findRelation: ', findRelation);

  if(!findRelation) {
    await strapi.services[relationType].create({
      name: name,
      slug: slugify(name).toLowerCase()
    })
  }
}

module.exports = {
  populate: async (params) => {
    console.log('Executing game service...')

    const gogApiUrl = `https://www.gog.com/games/ajax/filtered?mediaType=game&page=1&sort=popularity`

    const { data : { products } } = await axios.get(gogApiUrl)

    console.log(await getGameInfo(products[1].slug))

    await handleRelationCreation('publisher', products[1].publisher)
    await handleRelationCreation('developer', products[1].developer)
  }
};

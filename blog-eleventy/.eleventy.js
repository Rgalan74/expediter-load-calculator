module.exports = function (eleventyConfig) {
  // Si más adelante hay imágenes propias de posts, aquí se agregaría passthrough copy.
  // eleventyConfig.addPassthroughCopy("blog-source/img");

  eleventyConfig.addFilter("readableDateEs", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  eleventyConfig.addFilter("readableDateEn", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    const d = new Date(dateObj);
    return d.toISOString().split("T")[0];
  });

  // Colecciones para el índice del blog, separadas por idioma
  eleventyConfig.addCollection("postsEs", (collectionApi) => {
    return collectionApi.getFilteredByTag("postEs").sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("postsEn", (collectionApi) => {
    return collectionApi.getFilteredByTag("postEn").sort((a, b) => b.date - a.date);
  });

  return {
    dir: {
      input: "blog-source",
      includes: "_includes",
      // OUTPUT AISLADO A PROPÓSITO: no apunta directo a /public.
      // Primero se revisa/diffea aquí, luego se copia manualmente (o vía script)
      // dentro de public/blog/ y public/en/blog/. Esto respeta el protocolo de
      // "nunca aceptar el resultado del agente como verdad" — Ricardo verifica
      // el HTML generado antes de que toque producción.
      output: "_site_blog",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
};

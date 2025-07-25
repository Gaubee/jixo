function readPackage(pkg, context) {
//   // Override the manifest of foo@1.x after downloading it from the registry
//   if (pkg.dependencies && pkg.dependencies.zod) {
//     const old = pkg.dependencies.zod;
//     pkg.dependencies.zod = "^4.0.0";
//     context.log(`zod@${old} => zod@4 in dependencies of foo`);
//   }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};

# dist is built and typechecked locally with the public HTTPS API URLs.
# Only static build output enters this image; no source or secret files.
ARG NGINX_IMAGE=nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236
FROM ${NGINX_IMAGE}
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY public/ /usr/share/nginx/html/
ENV FRONTEND_BIND_HOST=0.0.0.0
ENV FRONTEND_PORT=18000
ENV ROUTER_INTERNAL_URL=http://127.0.0.1:18080
EXPOSE 18000

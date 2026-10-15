FROM public.ecr.aws/docker/library/node@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
LABEL io.printform.coding.protocol="printform-coding-v1"
LABEL io.printform.coding.base="sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20"
COPY --chown=0:0 *.mjs Dockerfile /opt/printform/
RUN chmod -R a-w /opt/printform && mkdir -p /workspace && chown 1000:1000 /workspace
USER 1000:1000
WORKDIR /workspace
ENV HOME=/tmp CI=1 NODE_ENV=test LANG=C.UTF-8 TZ=UTC
ENTRYPOINT []
CMD ["node", "--disable-sigusr1", "/opt/printform/supervisor.mjs", "anchor", "4200000"]

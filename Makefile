BUCKET := "dreployments"
NAME := "bravobot"
REGION := "us-east-1"
#.PHONY

all: build push deploy
	@echo "upload ${NAME} to s3://${BUCKET}/${NAME}.zip - https://s3-${REGION}.amazonaws.com/${BUCKET}/${NAME}.zip"
	@echo "https://s3-${REGION}.amazonaws.com/${BUCKET}/${NAME}.zip" | pbcopy


build:
	zip -r $(NAME).zip ./index.js
	zip -r $(NAME).zip ./node_modules

push:
	aws s3 cp ./$(NAME).zip s3://$(BUCKET)/$(NAME).zip --profile dre

deploy:
	aws lambda update-function-code --function-name $(NAME) --s3-bucket $(BUCKET) --s3-key $(NAME).zip --profile dre
FROM php:8.5-fpm

# Xdebug is omitted: its stable release does not yet build on PHP 8.5.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip \
    && rm -rf /var/lib/apt/lists/*

# pdo_mysql is for the later persistence work; V1 renders with no DB.
# Installed in its own layer — bundling extensions triggers a
# "cp: cannot stat 'modules/*'" install failure on this PHP 8.5 image.
RUN docker-php-ext-install pdo_mysql

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-app.ini

WORKDIR /var/www/html
